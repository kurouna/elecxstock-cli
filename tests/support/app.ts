// E2E の部品: 種の data フォルダの写しで、実際の読み口（Reader）と画面（App）を動かし、キーを流して画面の文字を確かめる
import React from 'react'
import stringWidth from 'string-width'
import { App } from '../../src/app'
import { Reader } from '../../src/source/reader'
import { copySeed } from './copy'
import { renderIn } from './terminal'

export { copySeed }

export const K = {
  up: '\u001B[A',
  down: '\u001B[B',
  right: '\u001B[C',
  left: '\u001B[D',
  enter: '\r',
  tab: '\t',
  shiftTab: '\u001B[Z',
  esc: '\u001B',
  backspace: '\u007F',
  pageDown: '\u001B[6~',
  pageUp: '\u001B[5~',
}

export interface Started {
  frame: () => string
  lines: () => string[]
  /** キーを 1 つずつ流す（押すたびに描き直しを待つ） */
  press: (...keys: string[]) => Promise<void>
  /** 画面に text が出るまで待つ（出なければ失敗） */
  until: (text: string | RegExp | ((f: string) => boolean), ms?: number) => Promise<void>
  /** 選んでいる行（左に ▌ が付いた行） */
  selected: () => string | undefined
  exited: () => boolean
  reader: Reader
  dir: string
  stop: () => void
}

export async function start(
  opts: { width?: number; height?: number; tab?: number; checkMs?: number; dir?: string } = {},
): Promise<Started> {
  const seed = opts.dir ? null : copySeed()
  const dir = opts.dir ?? seed!.dir
  const reader = new Reader(dir)
  let exited = false
  const W = opts.width ?? 120
  const H = opts.height ?? 40
  const inst = renderIn(
    React.createElement(App, {
      reader,
      width: W,
      height: H,
      initialTab: opts.tab,
      checkMs: opts.checkMs ?? 60_000,
      onExit: () => {
        exited = true
      },
    }),
    W,
    H,
  )
  const frame = () => inst.lastFrame()
  const until = async (text: string | RegExp | ((f: string) => boolean), ms = 3000) => {
    const ok = (f: string) => (typeof text === 'string' ? f.includes(text) : text instanceof RegExp ? text.test(f) : text(f))
    const t0 = Date.now()
    while (!ok(frame())) {
      if (Date.now() - t0 > ms) throw new Error(`画面に ${String(text)} が出ない:\n${frame()}`)
      await new Promise((r) => setTimeout(r, 10))
    }
  }
  const press = async (...keys: string[]) => {
    for (const k of keys) {
      const before = inst.frames.length
      inst.stdin.write(k)
      // 描き直しを待つ（変わらないキーもあるので、長くは待たない）
      for (let i = 0; i < 20 && inst.frames.length === before; i++) await new Promise((r) => setTimeout(r, 5))
    }
  }
  await until('elecxstock-cli')
  return {
    frame,
    lines: () => frame().split('\n'),
    press,
    until,
    selected: () =>
      frame()
        .split('\n')
        .find((l) => l.includes('▌')),
    exited: () => exited,
    reader,
    dir,
    stop: () => {
      inst.unmount()
      reader.close()
      seed?.dispose()
    },
  }
}

/** 表示の幅（全角は 2） */
export const width = (s: string) => stringWidth(s)
