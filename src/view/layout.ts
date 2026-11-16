// 表の列の選び方と、表示の窓（選んだ行が見えるようにずらす）
export interface Col {
  k: 'code' | 'name' | 'price' | 'chg' | 'yld' | 'target' | 'pos' | 'rec' | 'spark'
  t: string
  w: number
  /** 大きいものから、幅が足りないときに落とす（0 は落とさない） */
  prio: number
  right?: boolean
}
export const COLS: Col[] = [
  { k: 'code', t: 'コード', w: 8, prio: 0 },
  { k: 'name', t: '銘柄', w: 0, prio: 0 },
  { k: 'price', t: '終値', w: 10, prio: 0, right: true },
  { k: 'chg', t: '前日比', w: 9, prio: 0, right: true },
  { k: 'yld', t: '利回り', w: 8, prio: 1, right: true },
  { k: 'target', t: '水準まで', w: 11, prio: 2, right: true },
  { k: 'pos', t: '52週の位置', w: 15, prio: 3 },
  { k: 'rec', t: '権利月', w: 10, prio: 4, right: true },
  { k: 'spark', t: '1年', w: 15, prio: 5 },
]
const NAME_MIN = 16
const NAME_MAX = 34

/** 幅に収まる列（銘柄は残りの幅。NAME_MIN 未満にはしない） */
export function pickCols(width: number): Col[] {
  const cols = [...COLS]
  const need = () => cols.reduce((a, c) => a + c.w, 0) + NAME_MIN
  while (need() > width) {
    const drop = cols.reduce((a, c) => (c.prio > a.prio ? c : a))
    if (!drop.prio) break
    cols.splice(cols.indexOf(drop), 1)
  }
  const rest = width - cols.reduce((a, c) => a + c.w, 0)
  return cols.map((c) => (c.k === 'name' ? { ...c, w: Math.max(NAME_MIN, Math.min(NAME_MAX, rest)) } : c))
}

/** n 行のうち、sel が見えるように size 行の窓 [start, end) */
export function windowed(n: number, sel: number, size: number): [number, number] {
  if (n <= size) return [0, n]
  const start = Math.max(0, Math.min(n - size, sel - Math.floor(size / 2)))
  return [start, start + size]
}
