// キー操作の状態（純粋な関数）: 端の場合（同じコードが 2 行・IME の確定・選んだ行が消えた・リストが減った）
import { describe, expect, it } from 'vitest'
import { type Ctx, clampLists, initialState, type Key, reduce, type State, selIndex } from '../../src/state'

const ctx = (codes: string[], keys = codes, extra: Partial<Ctx> = {}): Ctx => ({
  items: codes.map((code, i) => ({ key: keys[i]!, code })),
  gridPer: 3,
  lists: 3,
  screens: 2,
  exists: (c) => c === '8951',
  ...extra,
})
const press = (s: State, c: Ctx, ...keys: (string | Key)[]) => {
  let st = s
  const effects: (string | null)[] = []
  for (const k of keys) {
    const r = typeof k === 'string' ? reduce(st, k, {}, c) : reduce(st, '', k, c)
    st = r.state
    effects.push(r.effect)
  }
  return { st, effects }
}

describe('詳細の n・N', () => {
  it('同じコードが 2 行（NISA と特定）あっても、行の位置で次へ進む', () => {
    const c = ctx(['8951', '8951', '9432'], ['nisa_growth:8951', 'tokutei:8951', 'tokutei:9432'])
    let { st } = press(initialState(3), c, { return: true })
    expect(st.detail?.code).toBe('8951')
    st = press(st, c, 'n').st
    st = press(st, c, 'n').st
    expect(st.detail?.code).toBe('9432')
    expect(st.sel[3]).toBe('tokutei:9432')
    st = press(st, c, 'N').st
    expect(st.sel[3]).toBe('tokutei:8951')
  })
})

describe('コードの入力（/）', () => {
  it('IME の確定や貼り付けのように、まとめて届いた文字も入る（全角は半角に）', () => {
    const c = ctx(['8951'])
    let { st } = press(initialState(), c, '/', '８９５１')
    expect(st.typing).toBe('8951')
    st = press(st, c, { return: true }).st
    expect(st.detail?.code).toBe('8951')
    expect(press(initialState(), c, '/', '1234567').st.typing).toBe('12345')
    expect(press(initialState(), c, '/', '13a1 ').st.typing).toBe('13A1')
  })
  it('入力中・キーの一覧を出しているときも Ctrl+C で終わる', () => {
    const c = ctx(['8951'])
    expect(press(initialState(), c, '/', '8').effects).toEqual([null, null])
    const typing = press(initialState(), c, '/').st
    expect(reduce(typing, 'c', { ctrl: true }, c).effect).toBe('exit')
    const help = press(initialState(), c, '?').st
    expect(reduce(help, 'c', { ctrl: true }, c).effect).toBe('exit')
  })
})

describe('選んだ行が消えたとき', () => {
  it('同じ位置（端を超えれば最後）の行を選ぶ。先頭へ飛ばない', () => {
    const c = ctx(['1', '2', '3', '4'])
    const { st } = press(initialState(), c, { downArrow: true }, { downArrow: true })
    expect(st.sel[2]).toBe('3')
    expect(selIndex(st, ctx(['1', '2', '4']).items)).toBe(2)
    expect(selIndex(st, ctx(['1', '2']).items)).toBe(1)
    // 消えた行の次の行で ↓ を押すと、その次へ
    const r = reduce(st, '', { downArrow: true }, ctx(['1', '2', '4', '5']))
    expect(r.state.sel[2]).toBe('5')
  })
})

describe('リスト・スクリーンが減ったとき', () => {
  it('範囲の外の番号を最後に寄せる（無ければ 0）', () => {
    const s = { ...initialState(), list: 4, screen: 2 }
    expect(clampLists(s, 3, 1)).toMatchObject({ list: 2, screen: 0 })
    expect(clampLists(s, 0, 0)).toMatchObject({ list: 0, screen: 0 })
    const ok = { ...initialState(), list: 1 }
    expect(clampLists(ok, 3, 1)).toBe(ok)
  })
})
