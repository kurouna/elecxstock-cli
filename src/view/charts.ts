// 小さなグラフ（純粋な関数）。どれも行の高さを使わない字で描く（Windows Terminal はブロックの字を上下いっぱいに描き、
// 上下の行とつながって塊に見えるため。面のチャートだけは塗りがつながってよい）。docs/design.md §3.1
import { textWidth } from './width'

/** 区間ごとの [最小, 最大, 最後]（間引きで高値・安値を落とさない） */
export function buckets(values: number[], n: number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i / n) * values.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * values.length))
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (let k = a; k < b && k < values.length; k++) {
      lo = Math.min(lo, values[k]!)
      hi = Math.max(hi, values[k]!)
    }
    const last = values[Math.min(b, values.length) - 1]!
    return [lo, hi, last]
  })
}

/** 点字の線（width 文字 × rows 行 = 横 2width × 縦 4rows の点）。区間の最小〜最大と前の点を縦につなぐ */
export function braille(values: number[], width: number, rows: number): { lines: string[]; lo: number; hi: number } {
  const W = width * 2
  const H = rows * 4
  if (!values.length || width <= 0 || rows <= 0)
    return { lines: Array(Math.max(0, rows)).fill(' '.repeat(Math.max(0, width))), lo: 0, hi: 0 }
  const b = buckets(values, W)
  const lo = Math.min(...b.map((x) => x[0]))
  const hi = Math.max(...b.map((x) => x[1]))
  const yOf = (v: number) => Math.round((1 - (v - lo) / (hi - lo || 1)) * (H - 1))
  const grid = Array.from({ length: rows }, () => new Array<number>(width).fill(0))
  const BIT = [
    [0x1, 0x2, 0x4, 0x40],
    [0x8, 0x10, 0x20, 0x80],
  ]
  let prev: number | null = null
  b.forEach(([l, u, last], x) => {
    let top = yOf(u)
    let bot = yOf(l)
    if (prev != null) {
      top = Math.min(top, prev)
      bot = Math.max(bot, prev)
    }
    for (let y = top; y <= bot; y++) grid[Math.floor(y / 4)]![Math.floor(x / 2)]! |= BIT[x % 2]![y % 4]!
    prev = yOf(last)
  })
  return { lines: grid.map((r) => r.map((c) => String.fromCharCode(0x2800 + c)).join('')), lo, hi }
}

/** 位置の印（52 週のどこにいるか）: 細い線の上に ●。left と right の線の長さを返す（● は描く側で足す） */
export function gauge(frac: number, width: number): { left: string; right: string } {
  const f = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0
  const p = Math.round(f * (width - 1))
  return { left: '─'.repeat(p), right: '─'.repeat(Math.max(0, width - 1 - p)) }
}

/** 太い横線（━）の長さ */
export const thinLen = (frac: number, width: number): number =>
  Math.max(0, Math.round(Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0)) * width))

/** きりのよい目盛り（およそ n 個） */
export function niceTicks(lo: number, hi: number, n: number): number[] {
  if (!(hi > lo)) return []
  const raw = (hi - lo) / Math.max(1, n)
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

export type Role = 'area' | 'top' | 'mark' | null
export type Cell = [string, Role]

/**
 * 面のチャート（半ブロック）: 1 文字を上下 2 段に分けて塗る（縦は行の 2 倍の細かさ）。
 * marks: 水平線（目標利回りなど）。範囲に入るものだけ、空いたところに点線で描く
 */
export function areaChart(values: number[], width: number, rows: number, marks: { price: number }[] = []) {
  const b = values.length ? buckets(values, width).map((x) => x[2]) : []
  let lo = b.length ? Math.min(...b) : 0
  let hi = b.length ? Math.max(...b) : 1
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1
  lo -= pad
  hi += pad
  const H = rows * 2
  const lv = (v: number) => Math.max(1, Math.round(((v - lo) / (hi - lo)) * H))
  const rowOf = (v: number) => Math.max(0, Math.min(rows - 1, rows - 1 - Math.floor(((v - lo) / (hi - lo)) * rows)))
  const out: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const base = (rows - 1 - r) * 2
    const cells: Cell[] = b.map((v) => {
      const L = lv(v)
      if (L >= base + 2) return ['█', L === base + 2 ? 'top' : 'area']
      if (L === base + 1) return ['▄', 'top']
      return [' ', null]
    })
    while (cells.length < width) cells.push([' ', null])
    for (const m of marks)
      if (m.price > lo && m.price < hi && rowOf(m.price) === r)
        for (const c of cells)
          if (c[0] === ' ') {
            c[0] = '┄'
            c[1] = 'mark'
          }
    out.push(cells)
  }
  return { rows: out, lo, hi, rowOf }
}

/**
 * 日付の目盛り（2 行: 印とラベル）。左端に始まりの年月。1 年を超えたら年ごと、そうでなければ月ごと（1 月は年も）
 */
export function dateAxis(dates: string[], width: number): [string, string] {
  if (!dates.length || width <= 0) return ['', '']
  // 1 年を大きく超える期間は年の目盛り（週足・月足の 5 年も。足の本数では決めない）
  const long = Date.parse(dates.at(-1)!) - Date.parse(dates[0]!) > 400 * 86400000
  const at = (x: number) => dates[Math.min(dates.length - 1, Math.floor((x / width) * dates.length))]!
  const first = at(0)
  const ticks = [{ x: 0, label: `${first.slice(0, 4)}/${first.slice(5, 7)}` }]
  let last = long ? first.slice(0, 4) : first.slice(0, 7)
  for (let x = 1; x < width; x++) {
    const d = at(x)
    const key = long ? d.slice(0, 4) : d.slice(0, 7)
    if (key === last) continue
    last = key
    ticks.push({ x, label: long ? `${d.slice(0, 4)}年` : d.slice(5, 7) === '01' ? `${d.slice(0, 4)}年1月` : `${Number(d.slice(5, 7))}月` })
  }
  const keep: typeof ticks = []
  for (const t of ticks) if (!keep.length || t.x - keep.at(-1)!.x >= textWidth(keep.at(-1)!.label) + 2) keep.push(t)
  const mark = new Array<string>(width).fill('─')
  const label = new Array<string>(width).fill(' ')
  for (const t of keep) {
    mark[t.x] = t.x ? '┬' : '├'
    let p = t.x
    for (const ch of t.label) {
      const w = textWidth(ch)
      if (p + w > width) break
      label[p] = ch
      if (w === 2) label[p + 1] = ''
      p += w
    }
  }
  return [mark.join(''), label.join('')]
}
