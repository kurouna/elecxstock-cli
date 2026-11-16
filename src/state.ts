// 画面の状態とキー操作（純粋な関数）。キーの意味はここ 1 か所で決める（docs/design.md §3.2）。
// 選んでいる行は位置ではなく中身（行のキー）で持つ（読み直しや並べ替えで並びが変わっても、選んだ銘柄から動かない）
import type { Sort } from './model'
import { SORTS } from './model'

export const TABS = ['マーケット', 'スクリーナー', 'ウォッチリスト', '保有', 'ポートフォリオ'] as const
export const SHORT_TABS = ['市場', 'スクリーン', 'ウォッチ', '保有', 'PF'] as const
export const PERIODS = [
  ['3M', 63],
  ['6M', 126],
  ['1Y', 245],
  ['5Y', 1225],
] as const
export const TFS = ['日足', '週足', '月足'] as const
export const CONTRIB = ['今日', '今月', '今年', '取得来'] as const

export interface State {
  tab: number
  /** 開いている詳細（Enter）。list は開いた元の一覧の行、index はその中の位置（n・N でめくる。同じコードが 2 行あっても進む） */
  detail: { code: string; from: number; list: { key: string; code: string }[]; index: number } | null
  /** 画面ごとに選んでいる行のキー */
  sel: (string | null)[]
  /** 画面ごとに最後に選んだ行の位置（選んだ行が消えたら、同じ位置の行を選ぶ） */
  idx: number[]
  list: number
  screen: number
  grid: boolean
  period: number
  tf: number
  cperiod: number
  sort: Sort
  /** コードの入力中（/） */
  typing: string | null
  help: boolean
  mask: boolean
  /** 一度だけ出す知らせ */
  message: string | null
}

export const initialState = (tab = 2): State => ({
  tab,
  detail: null,
  sel: [null, null, null, null, null],
  idx: [0, 0, 0, 0, 0],
  list: 0,
  screen: 0,
  grid: false,
  period: 2,
  tf: 0,
  cperiod: 0,
  sort: 'default',
  typing: null,
  help: false,
  mask: false,
  message: null,
})

/** キー（Ink の useInput と同じ形） */
export interface Key {
  upArrow?: boolean
  downArrow?: boolean
  leftArrow?: boolean
  rightArrow?: boolean
  pageUp?: boolean
  pageDown?: boolean
  return?: boolean
  escape?: boolean
  tab?: boolean
  shift?: boolean
  backspace?: boolean
  delete?: boolean
  ctrl?: boolean
  meta?: boolean
}

/** キーを解くのに要る、今の画面の行など */
export interface Ctx {
  /** 今の画面の行（キーと銘柄コード）。並びは画面と同じ */
  items: { key: string; code: string }[]
  /** 格子の 1 段の枚数（↑↓ はこの数ずつ） */
  gridPer: number
  lists: number
  screens: number
  exists: (code: string) => boolean
}

export type Effect = 'exit' | 'reload' | null

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 今の画面で選んでいる行の位置。キーが見つからなければ（読み直しで消えた）、最後に選んだ位置（端を超えれば最後の行） */
export function selIndex(s: State, items: { key: string }[]): number {
  const k = s.sel[s.tab]
  const i = k == null ? -1 : items.findIndex((x) => x.key === k)
  if (i >= 0) return i
  return clamp(k == null ? 0 : (s.idx[s.tab] ?? 0), 0, Math.max(0, items.length - 1))
}
const withSel = (s: State, key: string | null, index = 0): State => ({
  ...s,
  sel: s.sel.map((v, i) => (i === s.tab ? key : v)),
  idx: s.idx.map((v, i) => (i === s.tab ? index : v)),
})

/** リスト・スクリーンが減ったときに、範囲の外の番号を最後に寄せる（変わらなければ同じ状態を返す） */
export function clampLists(s: State, lists: number, screens: number): State {
  const list = clamp(s.list, 0, Math.max(0, lists - 1))
  const screen = clamp(s.screen, 0, Math.max(0, screens - 1))
  return list === s.list && screen === s.screen ? s : { ...s, list, screen }
}
/** IME の確定や貼り付けでまとめて届いた文字から、コードに使える英数字だけを取り出す */
const codeChars = (k: string) => k.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

export function reduce(s0: State, input: string, key: Key, ctx: Ctx): { state: State; effect: Effect } {
  const s = s0.message ? { ...s0, message: null } : s0
  const k = input.normalize('NFKC')
  const done = (state: State, effect: Effect = null) => ({ state, effect })

  if (key.ctrl && k === 'c') return done(s, 'exit')
  // コードの入力中: 英数字は入力に回す（画面は切り替えない）
  if (s.typing != null) {
    if (key.return) {
      const code = s.typing
      if (!code) return done({ ...s, typing: null })
      if (!ctx.exists(code)) return done({ ...s, typing: null, message: `${code} の銘柄はありません` })
      return done({ ...s, typing: null, detail: { code, from: s.tab, list: [{ key: code, code }], index: 0 } })
    }
    if (key.escape) return done({ ...s, typing: null })
    if (key.backspace || key.delete) return done({ ...s, typing: s.typing.slice(0, -1) })
    if (key.ctrl || key.meta) return done(s)
    const add = codeChars(k)
    return done(add ? { ...s, typing: (s.typing + add).slice(0, 5) } : s)
  }
  if (s.help) return done({ ...s, help: false })
  if (k === 'q') return done(s, 'exit')
  if (k === '?') return done({ ...s, help: true })
  if (k === '/') return done({ ...s, typing: '' })
  if (k === 'm') return done({ ...s, mask: !s.mask })
  if (k === 'r') return done(s, 'reload')

  // 詳細の中
  if (s.detail) {
    const d = s.detail
    if (key.backspace || key.delete || key.escape) return done({ ...s, detail: null })
    if (k === ',' || k === '.') return done({ ...s, period: clamp(s.period + (k === '.' ? 1 : -1), 0, PERIODS.length - 1) })
    if (k === 't') return done({ ...s, tf: (s.tf + 1) % TFS.length })
    if (k === 'n' || k === 'N') {
      const j = clamp(d.index + (k === 'n' ? 1 : -1), 0, d.list.length - 1)
      const it = d.list[j]!
      // 元の画面でも同じ行を選んでおく（戻ったときにそこにいる）
      const sel = s.sel.map((v, t) => (t === d.from ? it.key : v))
      const idx = s.idx.map((v, t) => (t === d.from ? j : v))
      return done({ ...s, sel, idx, detail: { ...d, code: it.code, index: j } })
    }
    if (!/^[1-5]$/.test(k) && !key.tab) return done(s)
  }

  const go = (tab: number): State => ({ ...s, tab, detail: null, grid: false })
  if (/^[1-5]$/.test(k)) return done(go(Number(k) - 1))
  if (key.tab) return done(go((s.tab + (key.shift ? TABS.length - 1 : 1)) % TABS.length))

  const n = ctx.items.length
  const i = selIndex(s, ctx.items)
  const move = (j: number) => {
    const at = clamp(j, 0, n - 1)
    return done(n ? withSel(s, ctx.items[at]!.key, at) : s)
  }
  const step = s.grid ? ctx.gridPer : 1
  if (key.upArrow) return move(i - step)
  if (key.downArrow) return move(i + step)
  if (s.grid && (key.leftArrow || key.rightArrow)) return move(i + (key.rightArrow ? 1 : -1))
  if (key.pageUp || key.pageDown) return move(i + (key.pageDown ? 10 : -10))
  if (key.return) {
    const it = ctx.items[i]
    if (!it) return done(s)
    return done({
      ...withSel(s, it.key, i),
      detail: { code: it.code, from: s.tab, list: ctx.items.map((x) => ({ key: x.key, code: x.code })), index: i },
    })
  }
  if (k === ',' || k === '.') return done({ ...s, period: clamp(s.period + (k === '.' ? 1 : -1), 0, PERIODS.length - 1) })
  if (k === 'v' && (s.tab === 1 || s.tab === 2)) return done({ ...s, grid: !s.grid })
  if (k === 'c' && s.tab === 4) return done({ ...s, cperiod: (s.cperiod + 1) % CONTRIB.length })
  if (k === 's' && (s.tab === 1 || s.tab === 2)) return done({ ...s, sort: SORTS[(SORTS.indexOf(s.sort) + 1) % SORTS.length]! })
  if (k === '[' || k === ']') {
    const d = k === ']' ? 1 : -1
    if (s.tab === 1 && ctx.screens) return done(withSel({ ...s, screen: (s.screen + d + ctx.screens) % ctx.screens }, null))
    if (s.tab === 2 && ctx.lists) return done(withSel({ ...s, list: (s.list + d + ctx.lists) % ctx.lists }, null))
  }
  return done(s)
}
