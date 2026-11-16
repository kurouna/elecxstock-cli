// 数の書式（elecxstock の表示に合わせる）。金額は m で隠す
export const fmt = (v: number, d = 0): string => v.toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d })
/** 株価: 1,000 未満は小数 1 桁 */
export const px = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '—' : fmt(v, Math.abs(v) < 1000 ? 1 : 0))
export const pct = (v: number | null | undefined, d = 2): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`
export const signed = (v: number): string => `${v >= 0 ? '+' : ''}${fmt(v)}`
/** 金額（隠すときは ••••••）。sign で符号を付ける */
export const money = (v: number, masked: boolean, sign = false): string => (masked ? '••••••' : sign ? signed(v) : fmt(v))
/** 万円（資産推移の目盛り） */
export const man = (v: number, masked: boolean): string => (masked ? '••••' : `${fmt(v / 1e4)}万`)
/** 'YYYY-MM-DD' → 'MM/DD' */
export const md = (d: string | null | undefined): string => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : '—')
