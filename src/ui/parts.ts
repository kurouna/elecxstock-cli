// 描画の部品（Ink）。色は elecxstock の app.css のトークン。地は塗らない（端末の地の色のまま）
import { Box, Text } from 'ink'
import React from 'react'

export const h = React.createElement

const DARK = {
  chip: '#1b2029',
  line: '#2d3540',
  text: '#dfe4ea',
  text2: '#a3adb9',
  text3: '#6f7986',
  focus: '#7aa7ff',
  select: '#1a2638',
  up: '#ff6b70',
  down: '#5aa2ee',
  flat: '#a3adb9',
  warn: '#d9a400',
  ok: '#2fae74',
  gold: '#e3b341',
  yield: '#5c9ead',
  accent: '#1d4f9e',
  accentFg: '#ffffff',
  upBg: '#3a1a1c',
  downBg: '#14263a',
  area: '#1e3a5f',
  areaTop: '#7aa7ff',
}
const LIGHT: typeof DARK = {
  chip: '#e6e9ee',
  line: '#c5ccd6',
  text: '#1d232b',
  text2: '#4a5562',
  text3: '#6b7684',
  focus: '#2f6fd6',
  select: '#dbe7fb',
  up: '#c8323a',
  down: '#1f6fc4',
  flat: '#4a5562',
  warn: '#9a6b00',
  ok: '#18794e',
  gold: '#8f6700',
  yield: '#2f6f8f',
  accent: '#1d4f9e',
  accentFg: '#ffffff',
  upBg: '#fbe3e4',
  downBg: '#e1ecfa',
  area: '#c9daf3',
  areaTop: '#2f6fd6',
}
export type Theme = typeof DARK

/** 描画の設定（App が描くたびに入れる。1 つの画面しか持たないので、部品から直に読む） */
export const ui = { C: DARK as Theme, mask: false, color: true }
export function setUi(theme: 'dark' | 'light', mask: boolean, color: boolean): void {
  ui.C = theme === 'light' ? LIGHT : DARK
  ui.mask = mask
  ui.color = color
}
/** 色（NO_COLOR のときは付けない） */
export const col = (c: string | undefined) => (ui.color ? c : undefined)

export const T = (props: Record<string, unknown>, ...kids: React.ReactNode[]) =>
  h(
    Text,
    { ...props, color: col(props.color as string | undefined), backgroundColor: col(props.backgroundColor as string | undefined) },
    ...kids,
  )
/** 文字だけの 1 行（入れ子の Text。幅が足りなければ行の終わりを切る。途中の数字を切らない） */
export const Line = (...kids: React.ReactNode[]) => h(Text, { wrap: 'truncate-end' }, ...kids)
export const Dim = (s: string, key?: string) => T({ key, color: ui.C.text3 }, s)
export const Kbd = (k: string, key?: string) => T({ key, backgroundColor: ui.C.chip, color: ui.C.text }, ` ${k} `)
export const Badge = (s: string, fg?: string, key?: string) => T({ key, backgroundColor: ui.C.chip, color: fg ?? ui.C.text2 }, ` ${s} `)
export const tone = (v: number | null | undefined) => (v == null ? ui.C.text3 : v > 0 ? ui.C.up : v < 0 ? ui.C.down : ui.C.flat)
export const flashBg = (f: number | undefined) => (f == null ? undefined : f > 0 ? ui.C.upBg : f < 0 ? ui.C.downBg : undefined)

/** 角の丸いカード。height を渡すとその高さに固定（中身ははみ出さない） */
export function Card(p: {
  title: string
  right?: string
  children?: React.ReactNode
  width?: number
  height?: number
  grow?: boolean
  focus?: boolean
}) {
  const C = ui.C
  return h(
    Box,
    {
      flexDirection: 'column',
      width: p.width,
      height: p.height,
      flexGrow: p.grow ? 1 : 0,
      flexShrink: p.grow ? 1 : 0,
      borderStyle: 'round',
      borderColor: col(p.focus ? C.focus : C.line),
      paddingX: 1,
      overflow: 'hidden',
    },
    h(
      Box,
      { justifyContent: 'space-between', height: 1, flexShrink: 0 },
      h(Box, { flexShrink: 1 }, T({ color: p.focus ? C.text : C.text2, bold: true, wrap: 'truncate' }, p.title)),
      p.right ? h(Box, { flexShrink: 1, marginLeft: 1 }, T({ color: C.text3, wrap: 'truncate' }, p.right)) : null,
    ),
    p.children,
  )
}
/** 右寄せの数（読み直しで変わったら 1 回だけ地の色で光らせる） */
export function Num(p: { v: string; width: number; color?: string; bold?: boolean; flash?: number }) {
  return h(
    Box,
    { width: p.width, justifyContent: 'flex-end', flexShrink: 0 },
    T({ color: p.color ?? ui.C.text, bold: p.bold, backgroundColor: flashBg(p.flash), wrap: 'truncate' }, p.v),
  )
}
/** 左寄せのセル（右に 1 桁あけて切り詰める） */
export function Cell(p: { width: number; text: string; color?: string; bold?: boolean }) {
  return h(
    Box,
    { width: p.width, paddingRight: 1, flexShrink: 0 },
    T({ color: p.color ?? ui.C.text, bold: p.bold, wrap: 'truncate' }, p.text),
  )
}
/** 選んだ行の左の印 */
export const Mark = (on: boolean) => T({ color: on ? ui.C.focus : ui.C.line }, on ? '▌' : ' ')
