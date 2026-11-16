// 全体: 状態の行・タブ・画面・キーの案内。データが変わったか（DB の data_version と利用者のデータの更新時刻）を
// checkMs ごとに確かめ、変わったときだけ読み直す。高さは端末の行数 − 1 を超えない（Ink が全体を描き直してちらつかないように）
import { Box, useApp, useInput, useStdout } from 'ink'
import { useEffect, useMemo, useRef, useState } from 'react'
import { events, marketState, since } from './model'
import type { Reader } from './source/reader'
import { type Ctx, clampLists, initialState, reduce, SHORT_TABS, type State, TABS } from './state'
import { Badge, Dim, h, Kbd, Line, setUi, T, ui } from './ui/parts'
import { Detail, Folio, gridPer, Help, Holdings, itemsOf, Market, Screener, Watch } from './ui/screens'
import { md } from './view/format'
import { textWidth } from './view/width'

export interface AppProps {
  reader: Reader
  /** 端末の大きさ（テストで決める。無ければ端末から） */
  width?: number
  height?: number
  initialTab?: number
  /** データが変わったかを確かめる間隔（ミリ秒） */
  checkMs?: number
  theme?: 'dark' | 'light'
  color?: boolean
  onExit?: () => void
}

/** 終値の印（読み直しで変わったセルを光らせるため） */
function closes(r: Reader): Map<string, number> {
  const out = new Map<string, number>()
  for (const [id, m] of r.metrics()) if (m.close != null) out.set(id, m.close)
  return out
}

export function App(p: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [size, setSize] = useState<[number, number]>([p.width ?? stdout.columns ?? 120, p.height ?? stdout.rows ?? 40])
  const [s0, setS] = useState<State>(() => initialState(p.initialTab != null ? p.initialTab - 1 : 2))
  // リスト・スクリーンが読み直しで減ったら、範囲の外の番号を寄せる
  const s = clampLists(s0, p.reader.watchlists().length, p.reader.screens().length)
  // キーが続けて来ても、前のキーの結果に重ねる（描き直しを待たない）
  const sRef = useRef(s)
  sRef.current = s
  const [version, setVersion] = useState(0)
  const [flashes, setFlashes] = useState<Record<string, number>>({})
  const [now, setNow] = useState(Date.now())
  const [lastRead, setLastRead] = useState(Date.now())
  const prev = useRef<Map<string, number>>(new Map())
  const clear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const r = p.reader
  const [cols, rows] = size

  // 端末の大きさ（テストで決めたときは変えない）
  useEffect(() => {
    if (p.width != null) return
    const onResize = () => setSize([stdout.columns, stdout.rows])
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout, p.width])

  // 読み直しで起きた誤り（アプリの版が上がった・DB を読めない）。出したら読み直しを止める（落とさない）
  const [fatal, setFatal] = useState<string | null>(null)
  const fatalRef = useRef<string | null>(null)
  const reload = (force = false) => {
    if (fatalRef.current) return
    try {
      if (force) r.invalidate()
      else if (!r.changed()) return
    } catch (e) {
      fatalRef.current = (e as Error).message
      setFatal(fatalRef.current)
      return
    }
    const next = closes(r)
    const f: Record<string, number> = {}
    for (const [id, c] of next) {
      const old = prev.current.get(id)
      if (old != null && old !== c) f[id] = Math.sign(c - old)
    }
    prev.current = next
    setLastRead(Date.now())
    setVersion((v) => v + 1)
    if (Object.keys(f).length) {
      setFlashes(f)
      clearTimeout(clear.current)
      clear.current = setTimeout(() => setFlashes({}), 1500)
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload は読み口と ref だけを使う（毎回作り直すので依存に入れない）
  useEffect(() => {
    prev.current = closes(r)
    const t = setInterval(() => reload(), p.checkMs ?? 2000)
    // 時計は分まで（分が変わったときだけ描き直す）
    const c = setInterval(() => setNow((x) => (Math.floor(Date.now() / 60_000) !== Math.floor(x / 60_000) ? Date.now() : x)), 5000)
    return () => {
      clearInterval(t)
      clearInterval(c)
      clearTimeout(clear.current)
    }
  }, [r, p.checkMs])

  setUi(p.theme ?? 'dark', s.mask, p.color ?? true)
  const bodyH = rows - 6 // 状態 1・タブ 3・案内 1・最後の 1 行はあける
  // biome-ignore lint/correctness/useExhaustiveDependencies: version で読み直した値を使う
  const items = useMemo(() => itemsOf(r, s, bodyH), [r, s.tab, s.list, s.screen, s.sort, s.cperiod, bodyH, version])
  const ctxOf = (st: State): Ctx => ({
    items: st === s ? items : itemsOf(r, st, bodyH),
    gridPer: gridPer(cols),
    lists: r.watchlists().length,
    screens: r.screens().length,
    exists: (code) => !!r.instrument(`JP:${code}`),
  })

  useInput((input, key) => {
    const cur = sRef.current
    const { state, effect } = reduce(cur, input, key, ctxOf(cur))
    if (state !== cur) {
      sRef.current = state
      setS(state)
    }
    if (effect === 'exit') {
      p.onExit?.()
      exit()
    } else if (effect === 'reload') reload(true)
  })

  const C = ui.C
  const narrow = cols < 110
  // 読み直しの時刻は広いときだけ（次の予定を先に出す）
  const wide = cols >= 140
  const st = r.status()
  const upd = since(st.lastUpdate, now)
  const unread = r.unreadAlerts()
  // 次の予定（保有・お気に入り）。状態の行に 1 つだけ（日本時間の今日から。画面 5 の「今後 30 日の予定」と同じ数え方）
  const ev = useMemo(() => {
    void version
    const e = events(r, 366, now)[0]
    return e ? `${md(e.date)} ${e.kind === '決算発表' ? '決算' : e.kind} ${e.row.code}` : null
  }, [r, version, now])
  const clock = new Date(now + 9 * 3600_000).toISOString()
  const wd = '日月火水木金土'[new Date(now + 9 * 3600_000).getUTCDay()]

  const body = s.help
    ? h(Help, { height: bodyH })
    : s.detail
      ? h(Detail, { r, s, width: cols, height: bodyH, flashes })
      : h([Market, Screener, Watch, Holdings, Folio][s.tab]!, { r, s, width: cols, height: bodyH, flashes })

  const hints: [string, string][] = s.detail
    ? [
        ['Backspace', '戻る'],
        ['n N', '次・前'],
        [', .', '期間'],
        ['t', '時間軸'],
      ]
    : [
        ['↑↓', '選ぶ'],
        ['Enter', '詳細'],
        ...((s.tab === 1 || s.tab === 2
          ? [
              ['[ ]', s.tab === 1 ? 'スクリーン' : 'リスト'],
              ['v', s.grid ? '表' : '格子'],
              ['s', '並べ替え'],
            ]
          : []) as [string, string][]),
        ...((s.grid || s.tab === 4 ? [[', .', '期間']] : []) as [string, string][]),
        ...((s.tab === 4 ? [['c', '寄与の期間']] : []) as [string, string][]),
      ]
  const tabLabel = (i: number) => (narrow ? SHORT_TABS[i]! : TABS[i]!)
  return h(
    Box,
    { flexDirection: 'column', width: cols, height: rows - 1 },
    // 状態の行
    h(
      Box,
      { paddingX: 1, height: 1, flexShrink: 0 },
      h(
        Box,
        { flexShrink: 0, marginRight: 2 },
        Line(
          T({ backgroundColor: C.accent, color: C.accentFg, bold: true }, ' elecxstock-cli '),
          T({ color: C.text2 }, `  ${clock.slice(5, 7)}/${clock.slice(8, 10)}(${wd}) ${clock.slice(11, 16)}  `),
          Badge(marketState(now)),
        ),
      ),
      h(
        Box,
        { flexGrow: 1, flexShrink: 1, justifyContent: 'flex-end', overflow: 'hidden' },
        Line(
          Dim('データ '),
          T({ color: C.text2 }, upd ? upd.at : '—'),
          Dim(upd ? `（${upd.ago}）` : ''),
          !wide ? T({}, '') : Dim(`  読み直し ${new Date(lastRead + 9 * 3600_000).toISOString().slice(11, 16)}`),
          T({}, '  '),
          Badge(`アラート ${unread}`, unread ? C.warn : C.text3),
          !narrow && ev ? Dim('  次の予定 ') : T({}, ''),
          !narrow && ev ? T({ color: C.gold }, ev) : T({}, ''),
          st.errors.length ? T({ color: C.warn }, `  読めないファイル ${st.errors.length}`) : T({}, ''),
        ),
      ),
    ),
    // タブ
    h(
      Box,
      { paddingX: 1, marginTop: 1, height: 2, flexShrink: 0 },
      ...TABS.map((_, i) =>
        h(
          Box,
          { key: i, marginRight: 1, flexDirection: 'column', flexShrink: 0 },
          Line(
            T({ backgroundColor: i === s.tab ? C.accent : C.chip, color: i === s.tab ? C.accentFg : C.text3 }, ` ${i + 1} `),
            T({ color: i === s.tab ? C.text : C.text3, bold: i === s.tab }, tabLabel(i)),
          ),
          i === s.tab ? T({ color: C.focus }, '▔'.repeat(textWidth(tabLabel(i)) + 3)) : T({}, ' '),
        ),
      ),
      s.detail
        ? h(
            Box,
            { marginLeft: 1, flexShrink: 1, overflow: 'hidden' },
            Line(Dim('› '), T({ bold: true }, `${s.detail.code} ${r.instrument(`JP:${s.detail.code}`)?.nameJa ?? ''}`)),
          )
        : null,
      s.mask ? h(Box, { marginLeft: 2, flexShrink: 0 }, Badge('金額を隠しています', C.warn)) : null,
    ),
    h(Box, { height: bodyH, flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }, body),
    // キーの案内（最下行に固定）
    h(
      Box,
      { paddingX: 1, height: 1, flexShrink: 0, justifyContent: 'space-between' },
      s.typing != null
        ? h(
            Box,
            { flexShrink: 1 },
            Line(
              Kbd('/'),
              T({ color: C.text }, ` コード: ${s.typing}`),
              T({ color: C.focus }, '▏'),
              Dim('   Enter 開く  Backspace 消す  Esc やめる'),
            ),
          )
        : fatal || s.message
          ? h(Box, { flexShrink: 1 }, Line(T({ color: C.warn }, fatal ? `${fatal}（読み直しを止めました。q で終わる）` : s.message!)))
          : h(
              Box,
              { flexShrink: 1, overflow: 'hidden' },
              Line(...hints.flatMap(([k, t]) => [Kbd(k, `k${k}`), T({ key: `t${k}`, color: C.text3 }, ` ${t}  `)])),
            ),
      h(
        Box,
        { flexShrink: 0 },
        Line(
          Kbd('/'),
          Dim(narrow ? ' ' : ' コード  '),
          Kbd('m'),
          Dim(narrow ? ' ' : ' 金額を隠す  '),
          Kbd('?'),
          Dim(narrow ? ' ' : ' キー  '),
          Kbd('q'),
          Dim(' 終了'),
        ),
      ),
    ),
  )
}
