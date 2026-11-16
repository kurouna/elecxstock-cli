// 画面のモデル（L3: 種の写しの実際の読み口で）: 保有の数え方・ポートフォリオの数・ランキングがアプリと同じ決まりで、
// 読み直しの印が判定の状態・CSV の情報の変化も拾う
import { readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { folioRows, folioSummary, holdingGroups, RANK_MIN_TURNOVER, rankings } from '../../src/model'
import { Reader } from '../../src/source/reader'
import { divSummary, heroNumbers, totalsOf } from '../../vendor/elecxstock/src/renderer/lib/folio'
import { copySeed } from '../support/copy'

let done: (() => void)[] = []
afterEach(() => {
  for (const d of done) d()
  done = []
})
function open(edit?: (dir: string) => void): Reader {
  const seed = copySeed()
  edit?.(seed.dir)
  const r = new Reader(seed.dir)
  done.push(() => {
    r.close()
    seed.dispose()
  })
  return r
}
/** 利用者のデータのファイルの中身（data）を差し替える（版はそのまま） */
function writeUser(dir: string, name: string, data: unknown) {
  const p = join(dir, 'user', `${name}.json`)
  let version = 1
  try {
    version = (JSON.parse(readFileSync(p, 'utf8')) as { version: number }).version
  } catch {}
  writeFileSync(p, JSON.stringify({ version, data }))
}

describe('保有の表（アプリの保有のペインと同じ数え方）', () => {
  const HOLD = [
    { code: '7203', account: 'tokutei', quantity: 100, avgCost: 15000 },
    { code: '8058', account: 'tokutei', quantity: 200, avgCost: 11000 },
    // 指標の無い銘柄（取り込んだばかり）: CSV の現在値で数える
    { code: '9999', account: 'tokutei', quantity: 10, avgCost: 1000, price: 1500 },
    // 指標も CSV の現在値も無い: 評価額は取得額で数える
    { code: '9998', account: 'tokutei', quantity: 10, avgCost: 2000 },
    // 売り切った（数量 0）: 出さない
    { code: '6501', account: 'tokutei', quantity: 0, avgCost: 3000 },
  ]
  it('現在値が無ければ CSV の現在値、それも無ければ取得額で数え、数量 0 は出さない。口座の中は評価額の大きい順', () => {
    const r = open((d) => writeUser(d, 'holdings', HOLD))
    const { groups, total } = holdingGroups(r)
    const lines = groups.flatMap((g) => g.lines)
    expect(lines.map((l) => l.h.code)).toEqual(['8058', '7203', '9999', '9998'])
    const n = lines.find((l) => l.h.code === '9999')!
    expect(n.close).toBe(1500)
    expect(n.value).toBe(15000)
    const none = lines.find((l) => l.h.code === '9998')!
    expect(none.value).toBeNull()
    const m = r.metrics()
    const v = m.get('JP:7203')!.close! * 100 + m.get('JP:8058')!.close! * 200 + 15000 + 20000
    expect(total.value).toBeCloseTo(v)
    expect(total.cost).toBe(1_500_000 + 2_200_000 + 10_000 + 20_000)
    expect(total.pnl).toBeCloseTo(v - total.cost)
    expect(total.n).toBe(4)
  })
  it('取得利回りは行も小計も税引前（配当/年の列は税引後）', () => {
    const r = open()
    const { groups, total } = holdingGroups(r)
    const lines = groups.flatMap((g) => g.lines)
    const gross = lines.reduce((s, l) => s + (l.div ?? 0), 0)
    expect(total.div).toBeCloseTo(gross)
    expect(total.divNet).toBeLessThan(total.div)
    const t = groups.find((g) => g.acct === 'tokutei')!
    for (const l of t.lines) if (l.div != null) expect(l.divNet).toBeCloseTo(l.div * (1 - 0.20315))
  })
})

describe('ポートフォリオの概要（アプリの heroNumbers・divSummary と同じ）', () => {
  it('トータル損益は CSV の実現損益と受取配当を足す。最高値からは記録の全期間の最高値から', () => {
    const r = open((d) =>
      writeUser(d, 'portfolioMeta', { broker: 'rakuten', importedAt: '2026-11-01T00:00:00+09:00', realized: 120000, dividends: 30000 }),
    )
    const f = folioSummary(r)
    const tot = totalsOf(folioRows(r))
    expect(f.totalPnl).toBeCloseTo(tot.pnl + 150000)
    const real = r.folioSeries().points.filter((p) => p.src !== 'est')
    const peak = Math.max(...real.map((p) => p.value))
    expect(f.fromPeak).toBeCloseTo((tot.value / peak - 1) * 100)
    expect(heroNumbers(r.folioSeries().points, null, tot, r.portfolioMeta()).total).toBe(f.totalPnl)
  })
  it('CSV の情報が無ければトータル損益は含み損益だけ。配当の利回りは税引前の年間配当 ÷ 評価額・取得額', () => {
    const r = open()
    const f = folioSummary(r)
    const tot = totalsOf(folioRows(r))
    expect(r.portfolioMeta()).toBeNull()
    expect(f.totalPnl).toBeCloseTo(tot.pnl)
    expect(f.yoc).not.toBeNull()
    expect(f.yieldNow!).toBeLessThan(f.yoc!)
    void divSummary
  })
})

describe('ランキング（アプリと同じく上場中・値上がり率は売買代金の下限あり）', () => {
  it('値上がり率・値下がり率は売買代金（20 日平均）1 億円以上、上場中の銘柄だけ', () => {
    const r = open()
    const { up, down, turnover } = rankings(r)
    expect(up.length).toBeGreaterThan(0)
    for (const x of [...up, ...down]) expect(x.m!.turnover20!).toBeGreaterThanOrEqual(RANK_MIN_TURNOVER)
    for (const x of [...up, ...down, ...turnover]) expect(x.ins?.status).toBe('active')
  })
})

describe('読み直しの印', () => {
  it('アラートの判定の状態（alertState.json）・CSV の情報（portfolioMeta.json）が変わっても読み直す', () => {
    let dir = ''
    const r = open((d) => {
      dir = d
    })
    expect(r.changed()).toBe(false)
    for (const name of ['alertState', 'portfolioMeta']) {
      const p = join(dir, 'user', `${name}.json`)
      writeFileSync(p, name === 'alertState' ? JSON.stringify({ version: 1, data: {} }) : JSON.stringify({ version: 1, data: null }))
      const t = new Date(Date.now() + 5000)
      utimesSync(p, t, t)
      expect(r.changed(), name).toBe(true)
      expect(r.changed()).toBe(false)
    }
  })
  it('invalidate は覚えた値を捨てる（r で読み直す）', () => {
    const r = open()
    const a = r.metrics()
    expect(r.metrics()).toBe(a)
    r.invalidate()
    expect(r.metrics()).not.toBe(a)
  })
})
