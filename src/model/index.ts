// 画面のモデル（読み口の値から、画面に出す行と数を作る）。描画（view）には計算を書かない
// 先に読む: elecxstock の folio.ts が引き込む Svelte のルーンの代わり（../runes.ts）
import '../runes'
import { type BreadthIn, type BreadthRow, breadth } from '@shared/breadth'
import { addDays, isMarketOpen, isTradingDay, jstNow } from '@shared/calendar'
import { DIVIDEND_TAX, netRate, twr } from '@shared/folio'
import { MARKET_REFS } from '@shared/markets'
import { epochDay } from '@shared/rights'
import type { AccountType, FolioSeriesPoint, Holding, Instrument, InstrumentId, MetricsRow, Settings } from '@shared/types'
import { yieldLines } from '@shared/yieldLines'
// アプリの画面のロジックのうち、ストアを引き込まない純粋な関数（elecxstock の renderer/lib/folio.ts）
import { divRows, divSummary, divYields, type FRow, heroNumbers, rowsOf, totalsOf } from '../../vendor/elecxstock/src/renderer/lib/folio'
import type { Reader } from '../source/reader'

export const ACCOUNT_LABEL: Record<AccountType, string> = {
  nisa_growth: 'NISA成長',
  nisa_tsumitate: 'つみたて',
  nisa_legacy: '旧NISA',
  tokutei: '特定',
  ippan: '一般',
}
const ACCOUNT_ORDER: AccountType[] = ['nisa_growth', 'nisa_tsumitate', 'nisa_legacy', 'tokutei', 'ippan']
export const isNisa = (a: AccountType) => a.startsWith('nisa')
export { DIVIDEND_TAX }

/** 一覧の 1 行（ウォッチリスト・スクリーナー・マーケットのランキング） */
export interface Row {
  key: string
  id: InstrumentId
  code: string
  name: string
  m: MetricsRow | undefined
  ins: Instrument | null
}
const codeOf = (id: InstrumentId) => id.slice(id.indexOf(':') + 1)
/** リストの名前（アプリの既定の名前に付く ★◆ は幅が端末とずれるので外す） */
export const listName = (s: string) => s.replace(/^[★◆☆◇]\s*/u, '')
export function rowOf(r: Reader, id: InstrumentId): Row {
  const ins = r.instrument(id)
  return { key: id, id, code: codeOf(id), name: ins?.nameJa ?? codeOf(id), m: r.metrics().get(id), ins }
}

// ---------------------------------------------------------------- 並べ替え（s）
export const SORTS = ['default', 'chg', 'yld', 'code'] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABEL: Record<Sort, string> = { default: '', chg: '前日比の高い順', yld: '利回りの高い順', code: 'コード順' }
export function sortRows(rows: Row[], s: Sort): Row[] {
  const num = (v: number | null | undefined) => (v == null ? Number.NEGATIVE_INFINITY : v)
  if (s === 'chg') return [...rows].sort((a, b) => num(b.m?.chgPct) - num(a.m?.chgPct))
  if (s === 'yld') return [...rows].sort((a, b) => num(b.m?.yieldTrailing) - num(a.m?.yieldTrailing))
  if (s === 'code') return [...rows].sort((a, b) => a.code.localeCompare(b.code))
  return rows
}

// ---------------------------------------------------------------- ウォッチリスト・スクリーナー
export function watchRows(r: Reader, list: number, sort: Sort): { name: string; rows: Row[] } {
  const lists = r.watchlists()
  const w = lists[Math.max(0, Math.min(lists.length - 1, list))]
  if (!w) return { name: '', rows: [] }
  return {
    name: listName(w.name.ja),
    rows: sortRows(
      w.items.map((id) => rowOf(r, id)),
      sort,
    ),
  }
}
export function screenRows(r: Reader, screen: number, sort: Sort): { name: string; rows: Row[]; invalid: number } {
  const ss = r.screens()
  const s = ss[Math.max(0, Math.min(ss.length - 1, screen))]
  if (!s) return { name: '', rows: [], invalid: 0 }
  const res = r.screen(s.conditions)
  const rows = res.ids.map((id) => rowOf(r, id))
  // 既定はアプリと同じく利回りの高い順
  return { name: s.name.ja, rows: sortRows(rows, sort === 'default' ? 'yld' : sort), invalid: res.invalid.length }
}

/** いちばん低い目標利回りの株価まで、今の株価から何 %（設定が OFF・配当が無ければ null） */
export function toTarget(m: MetricsRow | undefined, s: Settings): { pct: number; label: string } | null {
  // 利回りの低い順（株価の高い順）に並ぶので、先頭がいちばん低い目標
  const first = yieldLines(m, s)[0]
  if (!first) return null
  return first.gap == null ? null : { pct: first.gap, label: first.label }
}

// ---------------------------------------------------------------- マーケット
export interface MarketLine {
  group: string
  name: string
  id: InstrumentId
  close: number | null
  digits: number | undefined
  chgPct: number | null
  ret1m: number | null
  retYtd: number | null
  asOf: string | null
}
const GROUP_LABEL: Record<string, string> = { jp: '日本', us: '米国', asia: 'アジア', fx: '為替・金利', cmd: '商品', crypto: '暗号資産' }
export function marketLines(r: Reader): MarketLine[] {
  const ms = r.metrics()
  return MARKET_REFS.map((ref) => {
    const m = ms.get(ref.id)
    return {
      group: GROUP_LABEL[ref.group] ?? ref.group,
      name: ref.name.ja,
      id: ref.id,
      close: m?.close ?? null,
      digits: ref.digits,
      chgPct: m?.chgPct ?? null,
      ret1m: m?.ret1m ?? null,
      retYtd: m?.retYtd ?? null,
      asOf: m?.asOf ?? null,
    }
  })
}
/** 騰落（プライムの株式・J-REIT。アプリの騰落のペインと同じ集計） */
export function breadthRows(r: Reader): BreadthRow[] {
  const ins = r.instruments()
  const rows: BreadthIn[] = []
  for (const [id, m] of r.metrics()) {
    const i = ins.get(id)
    if (!i) continue
    if (i.market === 'P' && i.kind === 'stock') rows.push({ id, group: 'P', m })
    else if (i.market === 'R') rows.push({ id, group: 'R', m })
  }
  return breadth(rows).sort((a, b) => (a.key === 'P' ? -1 : b.key === 'P' ? 1 : 0))
}
/** 値上がり率・値下がり率に入れる売買代金（20 日平均）の下限（アプリのランキングと同じ。薄い銘柄が並ばないように） */
export const RANK_MIN_TURNOVER = 1e8
/** ランキング（プライム・J-REIT の上場中の銘柄） */
export function rankings(r: Reader): { up: Row[]; down: Row[]; turnover: Row[] } {
  const ins = r.instruments()
  const rows = [...r.metrics()].filter(([id]) => {
    const i = ins.get(id)
    return i && i.status === 'active' && ((i.market === 'P' && i.kind === 'stock') || i.market === 'R')
  })
  const liquid = rows.filter(([, m]) => (m.turnover20 ?? 0) >= RANK_MIN_TURNOVER)
  const toRow = ([id]: [InstrumentId, MetricsRow]) => rowOf(r, id)
  const by = (xs: [InstrumentId, MetricsRow][], f: (m: MetricsRow) => number | null, dir: 1 | -1) =>
    xs
      .filter(([, m]) => f(m) != null)
      .sort((a, b) => dir * (f(b[1])! - f(a[1])!) || a[0].localeCompare(b[0]))
      .map(toRow)
  return { up: by(liquid, (m) => m.chgPct, 1), down: by(liquid, (m) => m.chgPct, -1), turnover: by(rows, (m) => m.turnover, 1) }
}

// ---------------------------------------------------------------- 保有・ポートフォリオ
// 保有の表はアプリの保有のペイン（Portfolio.svelte の valuation と sum）と同じ数え方:
// 現在値は指標の終値、無ければ CSV の現在値。評価額が無い行は取得額で数える。数量 0 の行は出さない。口座ごとに評価額の大きい順
export interface HoldingLine {
  key: string
  h: Holding
  row: Row
  close: number | null
  value: number | null
  cost: number
  today: number | null
  pnl: number | null
  rate: number | null
  share: number | null
  /** 過去 12 か月の配当 × 数量（税引前・税引後。NISA は非課税） */
  div: number | null
  divNet: number | null
  yoc: number | null
}
export interface HoldingGroup {
  acct: AccountType
  label: string
  lines: HoldingLine[]
  sum: Sum
}
export interface Sum {
  n: number
  value: number
  today: number
  pnl: number
  cost: number
  div: number
  divNet: number
}
function sum(lines: HoldingLine[]): Sum {
  const s: Sum = { n: lines.length, value: 0, today: 0, pnl: 0, cost: 0, div: 0, divNet: 0 }
  for (const l of lines) {
    s.value += l.value ?? l.cost
    s.cost += l.cost
    s.today += l.today ?? 0
    s.div += l.div ?? 0
    s.divNet += l.divNet ?? 0
  }
  s.pnl = s.value - s.cost
  return s
}
/** 1 行の評価（アプリの valuation と同じ） */
export function lineOf(r: Reader, h: Holding): HoldingLine {
  const row = rowOf(r, `JP:${h.code}`)
  const m = row.m
  const close = m?.close ?? h.price ?? null
  const value = close != null ? close * h.quantity : null
  const cost = h.avgCost * h.quantity
  const pnl = value != null ? value - cost : null
  const div = m?.div12 != null ? m.div12 * h.quantity : null
  return {
    key: `${h.account}:${h.code}`,
    h,
    row,
    close,
    value,
    cost,
    today: m?.chg != null ? m.chg * h.quantity : null,
    pnl,
    rate: pnl != null && cost > 0 ? (pnl / cost) * 100 : null,
    share: null,
    div,
    divNet: div != null ? div * netRate(h.account) : null,
    yoc: m?.div12 != null && h.avgCost > 0 ? (m.div12 / h.avgCost) * 100 : null,
  }
}
export function holdingGroups(r: Reader): { groups: HoldingGroup[]; total: Sum } {
  const lines = r
    .holdings()
    .filter((h) => h.quantity > 0)
    .map((h) => lineOf(r, h))
  const total = sum(lines)
  for (const l of lines) l.share = total.value > 0 ? ((l.value ?? l.cost) / total.value) * 100 : null
  const groups = ACCOUNT_ORDER.flatMap((acct) => {
    const ls = lines.filter((l) => l.h.account === acct).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    return ls.length ? [{ acct, label: ACCOUNT_LABEL[acct], lines: ls, sum: sum(ls) }] : []
  })
  return { groups, total }
}

/** 今後 30 日の予定（保有とお気に入りの銘柄の権利付最終日・決算発表） */
export interface Event {
  date: string
  kind: '権利付最終日' | '決算発表'
  row: Row
}
export function events(r: Reader, days = 30, now = Date.now()): Event[] {
  const today = jstNow(now).date
  const t0 = epochDay(today)
  const fav = r.watchlists().find((w) => w.builtin === 'favorites')?.items ?? []
  const ids = [...new Set([...r.holdings().map((h) => `JP:${h.code}`), ...fav])]
  const out: Event[] = []
  const dateOf = (n: number) => addDays('1970-01-01', n)
  for (const id of ids) {
    const m = r.metrics().get(id)
    if (!m) continue
    for (const [n, kind] of [
      [m.rightsDay, '権利付最終日'],
      [m.earningsDay, '決算発表'],
    ] as const)
      if (n != null && n >= t0 && n <= t0 + days) out.push({ date: dateOf(n), kind, row: rowOf(r, id) })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.row.code.localeCompare(b.row.code))
}

/** 市場の状態（場中・大引け後・休場） */
export function marketState(now = Date.now()): string {
  const d = jstNow(now).date
  if (!isTradingDay(d)) return '休場'
  if (isMarketOpen(now)) return '場中'
  return jstNow(now).minutes < 9 * 60 ? '寄り前' : '大引け後'
}

/** ISO の日時を日本時間の 'MM/DD HH:mm' と、今からの経過 */
export function since(iso: string | null, now = Date.now()): { at: string; ago: string } | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const j = new Date(t + 9 * 3600_000).toISOString()
  const at = `${j.slice(5, 7)}/${j.slice(8, 10)} ${j.slice(11, 16)}`
  const min = Math.max(0, Math.round((now - t) / 60_000))
  const ago =
    min < 1 ? 'たった今' : min < 60 ? `${min}分前` : min < 60 * 24 ? `${Math.floor(min / 60)}時間前` : `${Math.floor(min / 1440)}日前`
  return { at, ago }
}

/** 損益寄与（銘柄ごと。口座をまたいで合計）。0 今日・1 今月・2 今年・3 取得来 */
export function contribRows(r: Reader, cperiod: number): { key: string; row: Row; amount: number }[] {
  const { groups } = holdingGroups(r)
  const lines = groups.flatMap((g) => g.lines)
  const by = new Map<string, number>()
  const add = (code: string, v: number) => by.set(code, (by.get(code) ?? 0) + v)
  if (cperiod === 0) for (const l of lines) add(l.h.code, l.today ?? 0)
  else if (cperiod === 3) for (const l of lines) add(l.h.code, l.pnl ?? 0)
  else for (const x of r.folioContrib(cperiod === 1 ? 'month' : 'year').rows) add(x.code, x.price + x.div)
  return [...by]
    .map(([code, amount]) => ({ key: code, row: rowOf(r, `JP:${code}`), amount }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))
}

/** ポートフォリオの行（アプリのポートフォリオのペインと同じ rowsOf。分割で換算した株数・終値が無ければ取得単価） */
export function folioRows(r: Reader): FRow[] {
  return rowsOf(
    r.holdings(),
    (id) => ({ m: r.metrics().get(id), ins: r.instrument(id) ?? undefined, name: r.instrument(id)?.nameJa ?? '' }),
    r.folioSeries().now,
  )
}
/** ポートフォリオの概要の数（アプリの heroNumbers・divSummary・divYields をそのまま使う） */
export function folioSummary(r: Reader) {
  const rows = folioRows(r)
  const tot = totalsOf(rows)
  const hero = heroNumbers(r.folioSeries().points, null, tot, r.portfolioMeta())
  const divs = r.folioDividends()
  const info = (code: string) => {
    const ins = r.instrument(`JP:${code}`) ?? undefined
    return { m: r.metrics().get(`JP:${code}`), ins, name: ins?.nameJa ?? code }
  }
  const dRows = divRows(divs, rows, info)
  const ds = dRows.length
    ? divSummary(
        dRows,
        !!divs.yearAgoDate,
        rows.map((x) => ({ code: x.code, acct: x.acct, qty: x.qty })),
      )
    : null
  const dy = ds ? divYields(ds.gross, tot) : { yld: null, yoc: null }
  const ms = r.metrics()
  return {
    value: tot.value,
    today: tot.day,
    cost: tot.cost,
    pnl: tot.pnl,
    totalPnl: hero.total,
    fromPeak: hero.fromPeak,
    /** 年間の配当（税引後。アプリの「年間配当」） */
    divNet: ds?.now ?? 0,
    divYoy: ds && (ds.hasYearAgo || ds.prev) && ds.prev ? (ds.delta / ds.prev) * 100 : null,
    yoc: dy.yoc,
    yieldNow: dy.yld,
    n225: ms.get('IDX:N225')?.chgPct ?? null,
    topix: ms.get('JP:1306')?.chgPct ?? null,
  }
}
/** 資産推移の期間の点（アプリの histPoints と同じく n+1 点）と、入出金を除いた騰落（時間加重。アプリの資産推移と同じ） */
export function folioHist(r: Reader, bars: number): { points: FolioSeriesPoint[]; ret: number | null } {
  const real = r.folioSeries().points.filter((p) => p.src !== 'est')
  const xs = real.slice(-(bars + 1))
  const points = xs.length >= 2 || !real.length ? xs : real.slice(-2)
  return { points, ret: points.length >= 2 ? (twr(points).at(-1) ?? null) : null }
}

/** 損益寄与の見方 */
export const CONTRIB_LABEL = '0 を中心に左が損・右が益'
