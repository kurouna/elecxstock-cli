// 描画の部品（純粋な関数）: 小さなグラフ・目盛り・列の選び方・表示の窓・文字の幅・金額の隠し方
import { describe, expect, it } from 'vitest'
import { areaChart, braille, buckets, dateAxis, gauge, niceTicks } from '../../src/view/charts'
import { money, pct, px } from '../../src/view/format'
import { pickCols, windowed } from '../../src/view/layout'
import { textWidth } from '../../src/view/width'

describe('小さなグラフ', () => {
  it('区間ごとの最小・最大を残す（間引きで高値・安値を落とさない）', () => {
    const v = [1, 9, 2, 3, 0, 4, 5, 6]
    const b = buckets(v, 2)
    expect(b[0]).toEqual([1, 9, 3])
    expect(b[1]).toEqual([0, 6, 6])
  })
  it('点字の線: 幅と行の数どおり、最小と最大を返す', () => {
    const r = braille([1, 2, 3, 4, 5, 6, 7, 8], 4, 2)
    expect(r.lines).toHaveLength(2)
    for (const l of r.lines) expect([...l]).toHaveLength(4)
    expect([r.lo, r.hi]).toEqual([1, 8])
  })
  it('面のチャート: 行の数どおり。いちばん下の行は塗る。目標の線は範囲に入るものだけ', () => {
    const c = areaChart([10, 12, 14, 16], 4, 3, [{ price: 13 }, { price: 99 }])
    expect(c.rows).toHaveLength(3)
    expect(c.rows[2]!.every(([ch]) => ch !== ' ')).toBe(true)
    expect(c.rows.flat().some(([ch]) => ch === '┄')).toBe(true)
  })
  it('位置の印は線の上に 1 つ。端も入る', () => {
    expect(gauge(0, 5)).toEqual({ left: '', right: '────' })
    expect(gauge(1, 5)).toEqual({ left: '────', right: '' })
    expect(gauge(0.5, 5)).toEqual({ left: '──', right: '──' })
  })
  it('目盛りはきりのよい値', () => {
    expect(niceTicks(88_000, 109_000, 3)).toEqual([90_000, 100_000])
    expect(niceTicks(88_000, 109_000, 5)).toEqual([90_000, 95_000, 100_000, 105_000])
    expect(niceTicks(0.9, 1.3, 2)).toEqual([1, 1.2])
  })
  it('日付の目盛り: 左端に始まりの年月、1 年以内は月（1 月は年も）、1 年を超えたら年', () => {
    const days = (from: string, n: number) =>
      Array.from({ length: n }, (_, i) => new Date(Date.parse(from) + i * 86400_000).toISOString().slice(0, 10))
    const [, short] = dateAxis(days('2025-11-15', 300), 60)
    expect(short.startsWith('2025/11')).toBe(true)
    expect(short).toContain('2026年1月')
    const [, long] = dateAxis(days('2022-01-15', 1500), 60)
    expect(long).toContain('2023年')
  })
})

describe('列と表示の窓', () => {
  it('幅が足りないときは優先度の低い列から落とし、銘柄の幅は残りを使う', () => {
    const wide = pickCols(140).map((c) => c.k)
    expect(wide).toContain('spark')
    const narrow = pickCols(76).map((c) => c.k)
    expect(narrow).not.toContain('spark')
    expect(narrow).not.toContain('pos')
    expect(narrow).toEqual(expect.arrayContaining(['code', 'name', 'price', 'chg']))
    const total = (w: number) => pickCols(w).reduce((a, c) => a + c.w, 0)
    for (const w of [76, 96, 116, 146]) expect(total(w)).toBeLessThanOrEqual(w)
  })
  it('選んだ行が見えるようにずらす', () => {
    expect(windowed(5, 0, 10)).toEqual([0, 5])
    expect(windowed(100, 0, 10)).toEqual([0, 10])
    expect(windowed(100, 50, 10)).toEqual([45, 55])
    expect(windowed(100, 99, 10)).toEqual([90, 100])
  })
})

describe('文字と数', () => {
  it('文字の幅: 全角は 2、点字・罫線・半ブロックは 1', () => {
    expect(textWidth('日本')).toBe(4)
    expect(textWidth('ab')).toBe(2)
    expect(textWidth('⣿━─┄▄█▌●◀')).toBe(9)
  })
  it('株価は 1,000 未満で小数 1 桁、% は符号付き、金額は隠せる', () => {
    expect(px(973)).toBe('973.0')
    expect(px(105000)).toBe('105,000')
    expect(pct(1.234)).toBe('+1.23%')
    expect(pct(-0.5, 1)).toBe('-0.5%')
    expect(money(1234567, false)).toBe('1,234,567')
    expect(money(1234567, true)).toBe('••••••')
    expect(money(-500, false, true)).toBe('-500')
    expect(money(500, false, true)).toBe('+500')
  })
})

describe('リストの名前', () => {
  it('アプリの既定の名前の ★ ◆ を外す（幅が端末とずれるため）', async () => {
    const { listName } = await import('../../src/model')
    expect(listName('★お気に入り')).toBe('お気に入り')
    expect(listName('◆ 売買候補')).toBe('売買候補')
    expect(listName('高配当')).toBe('高配当')
  })
})

describe('日付の軸は期間の長さで月か年かを決める（足の本数ではない）', () => {
  it('週足の 5 年（約 260 本）は年の目盛り', () => {
    const dates = Array.from({ length: 260 }, (_, i) => new Date(Date.UTC(2021, 10, 12) + i * 7 * 86400000).toISOString().slice(0, 10))
    const [, label] = dateAxis(dates, 80)
    expect(label).toContain('2023年')
    expect(label).not.toMatch(/\d月/)
  })
  it('日足の 1 年（245 本）は月の目盛り', () => {
    const dates = Array.from({ length: 245 }, (_, i) => new Date(Date.UTC(2025, 10, 14) + i * 1.49 * 86400000).toISOString().slice(0, 10))
    const [, label] = dateAxis(dates, 80)
    expect(label).toMatch(/\d月/)
  })
})
