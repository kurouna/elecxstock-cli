// テスト用の端末（ink-testing-library と同じ作りで、幅と高さを決められるもの）。
// ink-testing-library は幅を 100 桁に決め打ちしていて、それより広い画面を正しく描けないため
import { EventEmitter } from 'node:events'
import { render as inkRender } from 'ink'
import type React from 'react'

class Out extends EventEmitter {
  frames: string[] = []
  last = ''
  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
    this.last = frame
    return true
  }
}
class In extends EventEmitter {
  isTTY = true
  data: string | null = null
  write = (data: string) => {
    this.data = data
    this.emit('readable')
    this.emit('data', data)
  }
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => {
    const d = this.data
    this.data = null
    return d
  }
}

export function renderIn(tree: React.ReactElement, columns: number, rows: number) {
  const stdout = new Out(columns, rows)
  const stderr = new Out(columns, rows)
  const stdin = new In()
  const inst = inkRender(tree, {
    stdout: stdout as never,
    stderr: stderr as never,
    stdin: stdin as never,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  return { stdin, frames: stdout.frames, lastFrame: () => stdout.last, unmount: inst.unmount }
}
