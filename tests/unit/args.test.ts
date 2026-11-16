// 引数: 範囲の外の --tab で落ちない（起動の前に知らせる）
import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../src/args'

describe('引数', () => {
  it('--tab は 1〜5 の整数だけ。範囲の外・数でない値は誤り', () => {
    expect(parseArgs(['--tab', '4']).tab).toBe(4)
    expect(parseArgs(['--tab=１']).tab).toBe(1)
    for (const v of ['0', '9', 'x', '2.5', '-1']) expect(() => parseArgs(['--tab', v]), v).toThrow(/1〜5/)
    expect(() => parseArgs(['--tab'])).toThrow(/値がありません/)
  })
  it('--data・--theme・--no-color・NO_COLOR', () => {
    expect(parseArgs(['--data', 'D:/x/data']).data).toBe('D:/x/data')
    expect(parseArgs(['--data=d']).data).toBe('d')
    expect(parseArgs(['--theme', 'light']).theme).toBe('light')
    expect(() => parseArgs(['--theme', 'blue'])).toThrow(/dark か light/)
    expect(parseArgs(['--no-color']).color).toBe(false)
    expect(parseArgs([], { NO_COLOR: '1' }).color).toBe(false)
    expect(parseArgs([]).color).toBe(true)
    expect(() => parseArgs(['--nope'])).toThrow(/知らないオプション/)
  })
})
