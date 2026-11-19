// 画面（マーケット・スクリーナー・ウォッチリスト・保有・ポートフォリオ・詳細・キーの一覧）。数は model で作り、ここは並べるだけ
import { yieldLines } from '@shared/yieldLines'
import { Box, Text } from 'ink'
import type React from 'react'
import {
  ACCOUNT_LABEL,
  breadthRows,
  CONTRIB_LABEL,
  contribRows,
  events,
  folioHist,
  folioSummary,
  holdingGroups,
  isNisa,
  lineOf,
  listName,
  marketLines,
  type Row,
  rankings,
  SORT_LABEL,
  screenRows,
  toTarget,
  watchRows,
} from '../model'
import type { Reader } from '../source/reader'
import { CONTRIB, PERIODS, type State, selIndex, TFS } from '../state'
import { areaChart, braille, dateAxis, gauge, niceTicks, thinLen } from '../view/charts'
import { distance, fmt, man, md, money, pct, px, signed } from '../view/format'
import { pickCols, windowed } from '../view/layout'
import { Badge, Card, Dim, h, Kbd, Line, Mark, Num, T, tone, ui } from './parts'

export interface ScreenProps {
  r: Reader
  s: State
  width: number
  height: number
  flashes: Record<string, number>
}
type Item = { key: string; code: string }

// ---------------------------------------------------------------- 画面ごとの行（キー操作と描画で同じ並びを使う）
const rankCount = (height: number) => Math.max(2, Math.floor((height - 9) / 3) - 3)
export function itemsOf(r: Reader, s: State, height: number): Item[] {
  const toItem = (x: Row) => ({ key: x.key, code: x.code })
  switch (s.tab) {
    case 0:
      return rankings(r).up.slice(0, rankCount(height)).map(toItem)
    case 1:
      return screenRows(r, s.screen, s.sort).rows.map(toItem)
    case 2:
      return watchRows(r, s.list, s.sort).rows.map(toItem)
    case 3:
      return holdingGroups(r).groups.flatMap((g) => g.lines.map((l) => ({ key: l.key, code: l.h.code })))
    default:
      return contribRows(r, s.cperiod).map((x) => ({ key: x.key, code: x.row.code }))
  }
}
export const gridPer = (width: number) => (width >= 150 ? 4 : width >= 100 ? 3 : 2)

// ---------------------------------------------------------------- 一覧の表と格子
function Table(p: {
  r: Reader
  rows: Row[]
  sel: number
  width: number
  height: number
  flashes: Record<string, number>
}): React.ReactNode[] {
  const C = ui.C
  const st = p.r.settings()
  const cols = pickCols(p.width - 4)
  const vis = Math.max(1, p.height - 4)
  const [a, b] = windowed(p.rows.length, p.sel, vis)
  const lowTarget = st.yieldLine ? yieldLines({ div12: 1, yieldTrailing: 1, close: 1 }, st)[0]?.label : undefined
  const cell = (c: (typeof cols)[number], x: Row, on: boolean) => {
    const m = x.m
    switch (c.k) {
      case 'code':
        return h(Box, { key: c.k, width: c.w, flexShrink: 0 }, Mark(on), T({ color: C.text2 }, x.code))
      case 'name':
        return h(
          Box,
          { key: c.k, width: c.w, paddingRight: 1, flexShrink: 0 },
          h(Box, { flexGrow: 1, flexShrink: 1, overflow: 'hidden' }, T({ bold: on, wrap: 'truncate' }, x.name)),
          m?.provisional ? h(Box, { width: 3, flexShrink: 0, justifyContent: 'flex-end' }, T({ color: C.warn }, '仮')) : null,
        )
      case 'price':
        return h(Num, { key: c.k, v: px(m?.close), width: c.w, bold: true, color: m?.stale ? C.text3 : C.text, flash: p.flashes[x.id] })
      case 'chg':
        return h(Num, { key: c.k, v: pct(m?.chgPct), width: c.w, color: tone(m?.chgPct) })
      case 'yld': {
        const t = st.yieldLine && st.yieldTargets.length ? Math.min(...st.yieldTargets) : null
        return h(Num, {
          key: c.k,
          v: m?.yieldTrailing == null ? '—' : `${m.yieldTrailing.toFixed(2)}%`,
          width: c.w,
          color: t != null && (m?.yieldTrailing ?? 0) >= t ? C.yield : C.text,
        })
      }
      case 'target': {
        const t = toTarget(m, st)
        return h(Num, { key: c.k, v: t ? pct(t.pct, 1) : '—', width: c.w, color: C.text2 })
      }
      case 'pos': {
        const lo = m?.lo52
        const hi = m?.hi52
        const g = lo != null && hi != null && m?.close != null && hi > lo ? gauge((m.close - lo) / (hi - lo), c.w - 3) : null
        return h(
          Box,
          { key: c.k, width: c.w, paddingLeft: 2, flexShrink: 0 },
          g ? Line(T({ color: C.text3 }, g.left), T({ color: C.focus }, '●'), T({ color: C.text3 }, g.right)) : Dim('—'),
        )
      }
      case 'rec':
        return h(Num, { key: c.k, v: m?.recordMonths.length ? `${m.recordMonths.join('・')}月` : '—', width: c.w, color: C.text2 })
      case 'spark': {
        const cl = p.r.closes(x.id, 245)
        return h(
          Box,
          { key: c.k, width: c.w, paddingLeft: 1, flexShrink: 0 },
          cl.length > 1 ? T({ color: C.text2 }, braille(cl, c.w - 2, 1).lines[0]) : Dim('—'),
        )
      }
    }
  }
  const head = (c: (typeof cols)[number]) => {
    const t = c.k === 'target' ? (lowTarget ? `${lowTarget}水準まで` : '目標まで') : c.t
    return c.right
      ? h(Num, { key: c.k, v: t, width: c.w, color: C.text3 })
      : h(Box, { key: c.k, width: c.w, paddingLeft: c.k === 'pos' ? 2 : c.k === 'code' || c.k === 'spark' ? 1 : 0, flexShrink: 0 }, Dim(t))
  }
  return [
    h(Box, { key: 'head', height: 1, flexShrink: 0 }, ...cols.map(head)),
    ...p.rows
      .slice(a, b)
      .map((x, i) =>
        h(
          Box,
          { key: x.key, height: 1, flexShrink: 0, backgroundColor: a + i === p.sel ? C.select : undefined },
          ...cols.map((c) => cell(c, x, a + i === p.sel)),
        ),
      ),
    ...(p.rows.length ? [] : [h(Box, { key: 'empty' }, Dim('銘柄がありません'))]),
  ]
}

function Grid(p: {
  r: Reader
  rows: Row[]
  sel: number
  width: number
  height: number
  period: number
  flashes: Record<string, number>
}): React.ReactNode[] {
  const C = ui.C
  const per = gridPer(p.width)
  const w = Math.floor(p.width / per)
  const lineCount = Math.max(1, Math.round(p.height / 11))
  const cardH = Math.max(6, Math.floor(p.height / lineCount))
  const perPage = per * lineCount
  const page = Math.floor(p.sel / perPage)
  const [label, n] = PERIODS[p.period]!
  const shown = p.rows.slice(page * perPage, page * perPage + perPage)
  const lines: Row[][] = []
  for (let i = 0; i < shown.length; i += per) lines.push(shown.slice(i, i + per))
  return lines.map((row, ri) =>
    h(
      Box,
      { key: ri, height: cardH, flexShrink: 0 },
      ...row.map((x, k) => {
        const i = page * perPage + ri * per + k
        const bars = p.r.bars(x.id, 'D')
        const v = bars.close.slice(-n)
        const dates = bars.time.slice(-n)
        const ret = v.length > 1 ? (v.at(-1)! / v[0]! - 1) * 100 : null
        const g = braille(v, w - 4, Math.max(1, cardH - 5))
        return h(
          Card,
          { key: x.key, width: w, height: cardH, focus: i === p.sel, title: `${x.code} ${x.name}` },
          h(
            Box,
            { justifyContent: 'space-between', height: 1, flexShrink: 0 },
            T({ bold: true, backgroundColor: p.flashes[x.id] ? (p.flashes[x.id]! > 0 ? C.upBg : C.downBg) : undefined }, px(x.m?.close)),
            T({ color: tone(x.m?.chgPct) }, pct(x.m?.chgPct)),
            T({ color: tone(ret) }, `${label} ${pct(ret, 1)}`),
          ),
          ...g.lines.map((l, j) => T({ key: j, color: C.areaTop }, l)),
          h(
            Box,
            { justifyContent: 'space-between', height: 1, flexShrink: 0 },
            Dim(dates[0]?.slice(0, 7).replace('-', '/') ?? ''),
            Dim(v.length ? `${px(g.lo)} 〜 ${px(g.hi)}` : '—'),
            Dim(dates.at(-1)?.slice(0, 7).replace('-', '/') ?? ''),
          ),
        )
      }),
    ),
  )
}

function ListTabs(p: { names: string[]; cur: number; hint: string }) {
  const C = ui.C
  return h(
    Box,
    { paddingX: 1, height: 1, flexShrink: 0 },
    h(
      Box,
      { flexShrink: 1, overflow: 'hidden' },
      Line(
        ...p.names.flatMap((n, i) => [
          T({ key: `n${i}`, color: i === p.cur ? C.text : C.text3, bold: i === p.cur, underline: i === p.cur }, n),
          T({ key: `s${i}` }, '  '),
        ]),
      ),
    ),
    h(Box, { flexGrow: 1, justifyContent: 'flex-end', flexShrink: 0, marginLeft: 1 }, Line(Kbd('[ ]'), Dim(` ${p.hint}`))),
  )
}

export function Watch(p: ScreenProps) {
  const lists = p.r.watchlists()
  const { name, rows } = watchRows(p.r, p.s.list, p.s.sort)
  const sel = selIndex(p.s, rows)
  const bodyH = p.height - 1
  return h(
    Box,
    { flexDirection: 'column', height: p.height },
    h(ListTabs, { names: lists.map((l) => `${listName(l.name.ja)} ${l.items.length}`), cur: p.s.list, hint: 'リスト' }),
    p.s.grid
      ? h(
          Box,
          { flexDirection: 'column', height: bodyH },
          ...Grid({ r: p.r, rows, sel, width: p.width, height: bodyH, period: p.s.period, flashes: p.flashes }),
        )
      : h(
          Card,
          {
            title: `${name} ${rows.length} 銘柄`,
            right: `${rows.length ? sel + 1 : 0} / ${rows.length} · ${SORT_LABEL[p.s.sort] || '登録順'}`,
            height: bodyH,
          },
          ...Table({ r: p.r, rows, sel, width: p.width, height: bodyH, flashes: p.flashes }),
        ),
  )
}

export function Screener(p: ScreenProps) {
  const C = ui.C
  const screens = p.r.screens()
  const sc = screens[Math.min(p.s.screen, screens.length - 1)]
  const { rows, invalid } = screenRows(p.r, p.s.screen, p.s.sort)
  const sel = selIndex(p.s, rows)
  const conds = sc?.conditions ?? []
  const condH = Math.min(conds.length, 6) + 3
  const bodyH = p.height - 1 - condH
  return h(
    Box,
    { flexDirection: 'column', height: p.height },
    h(ListTabs, { names: screens.map((x) => x.name.ja), cur: p.s.screen, hint: '保存したスクリーン' }),
    h(
      Card,
      { title: '条件', right: invalid ? `無効な条件 ${invalid}` : '読むだけ（条件の編集はアプリで）', height: condH },
      ...conds
        .slice(0, 6)
        .map((c, i) =>
          Line(
            T({ key: 'a', color: C.text3 }, i ? (c.or ? 'または ' : 'かつ   ') : '       '),
            T({ key: 'b' }, c.field),
            T({ key: 'c', color: C.focus }, ` ${c.op} `),
            T({ key: 'd', bold: true }, ` ${Array.isArray(c.value) ? c.value.join(', ') : String(c.value)}${c.ref ? ` （${c.ref}）` : ''}`),
          ),
        ),
      ...(conds.length ? [] : [Dim('条件がありません')]),
    ),
    p.s.grid
      ? h(
          Box,
          { flexDirection: 'column', height: bodyH },
          ...Grid({ r: p.r, rows, sel, width: p.width, height: bodyH, period: p.s.period, flashes: p.flashes }),
        )
      : h(
          Card,
          {
            title: `結果 ${rows.length} 件`,
            right: `${rows.length ? sel + 1 : 0} / ${rows.length} · ${SORT_LABEL[p.s.sort === 'default' ? 'yld' : p.s.sort]}`,
            height: bodyH,
          },
          ...Table({ r: p.r, rows, sel, width: p.width, height: bodyH, flashes: p.flashes }),
        ),
  )
}

export function Market(p: ScreenProps) {
  const C = ui.C
  const wide = p.width >= 118
  const rightW = wide ? Math.max(48, p.width - 72) : p.width
  const inner = rightW - 4
  const n = rankCount(p.height)
  const rk = rankings(p.r)
  const sel = selIndex(p.s, rk.up.slice(0, n))
  const lines = marketLines(p.r)
  const groups = [...new Set(lines.map((l) => l.group))]
  const today = lines.find((l) => l.id === 'IDX:N225')?.asOf ?? null
  const rank = (title: string, list: Row[], val: (x: Row) => string, color: (x: Row) => string, selectable: boolean) =>
    h(
      Card,
      { key: title, title, height: n + 3 },
      ...list
        .slice(0, n)
        .map((x, i) =>
          h(
            Box,
            { key: x.key, height: 1, flexShrink: 0, backgroundColor: selectable && i === sel ? C.select : undefined },
            h(Box, { width: 6, flexShrink: 0 }, Mark(selectable && i === sel), T({ color: C.text3 }, x.code)),
            h(Box, { flexGrow: 1, flexShrink: 1, paddingRight: 1 }, T({ wrap: 'truncate' }, x.name)),
            h(Num, { v: val(x), width: 9, color: color(x) }),
          ),
        ),
    )
  const br = breadthRows(p.r)
  const tableW = wide ? 72 : p.width
  return h(
    Box,
    { height: p.height, flexDirection: wide ? 'row' : 'column', overflow: 'hidden' },
    h(
      Card,
      { title: 'マーケット', right: '取得時の値・日付は各市場の最後の足', width: tableW, grow: !wide },
      h(
        Box,
        { height: 1, flexShrink: 0 },
        h(Box, { width: 22, flexShrink: 0 }, Dim('')),
        h(Num, { v: '値', width: 14, color: C.text3 }),
        h(Num, { v: '前日比', width: 9, color: C.text3 }),
        h(Num, { v: '1か月', width: 8, color: C.text3 }),
        h(Num, { v: '年初来', width: 8, color: C.text3 }),
        h(Num, { v: '日付', width: 7, color: C.text3 }),
      ),
      ...groups.flatMap((g) => [
        h(Box, { key: g, height: 1, flexShrink: 0 }, Dim(g)),
        ...lines
          .filter((l) => l.group === g)
          .map((l) =>
            h(
              Box,
              { key: l.id, height: 1, flexShrink: 0 },
              h(Box, { width: 22, paddingRight: 1, flexShrink: 0 }, T({ wrap: 'truncate' }, `  ${l.name}`)),
              h(Num, {
                v: l.close == null ? '—' : l.digits != null ? fmt(l.close, l.digits) : px(l.close),
                width: 14,
                bold: true,
                flash: p.flashes[l.id],
              }),
              h(Num, { v: pct(l.chgPct), width: 9, color: tone(l.chgPct) }),
              h(Num, { v: pct(l.ret1m, 1), width: 8, color: tone(l.ret1m) }),
              h(Num, { v: pct(l.retYtd, 1), width: 8, color: tone(l.retYtd) }),
              h(Num, { v: md(l.asOf), width: 7, color: l.asOf && today && l.asOf !== today ? C.warn : C.text3 }),
            ),
          ),
      ]),
    ),
    h(
      Box,
      { flexDirection: 'column', width: wide ? rightW : p.width, height: wide ? p.height : undefined, overflow: 'hidden', flexShrink: 0 },
      h(
        Card,
        { title: '騰落', right: br[0]?.asOf ? `基準日 ${md(br[0].asOf)}` : '', height: 2 + 1 + 1 + br.length * 2 },
        h(
          Box,
          { height: 1, flexShrink: 0 },
          h(Box, { width: 9, flexShrink: 0 }, Dim('')),
          h(Num, { v: '上げ', width: 6, color: C.text3 }),
          h(Num, { v: '下げ', width: 6, color: C.text3 }),
          h(Num, { v: '新高値', width: 7, color: C.text3 }),
          h(Num, { v: '新安値', width: 7, color: C.text3 }),
          h(Num, { v: '売買代金', width: 9, color: C.text3 }),
        ),
        ...br.flatMap((b) => {
          const all = b.up + b.down || 1
          return [
            h(
              Box,
              { key: `${b.key}a`, height: 1, flexShrink: 0 },
              h(Box, { width: 9, flexShrink: 0 }, T({}, b.key === 'P' ? 'プライム' : 'J-REIT')),
              h(Num, { v: fmt(b.up), width: 6, color: C.up }),
              h(Num, { v: fmt(b.down), width: 6, color: C.down }),
              h(Num, { v: fmt(b.newHi), width: 7 }),
              h(Num, { v: fmt(b.newLo), width: 7 }),
              h(Num, {
                v: b.turnover == null ? '—' : b.turnover >= 1e12 ? `${fmt(b.turnover / 1e12, 2)}兆` : `${fmt(b.turnover / 1e8)}億`,
                width: 9,
                color: C.text2,
              }),
            ),
            h(
              Box,
              { key: `${b.key}b`, height: 1, flexShrink: 0 },
              h(Box, { width: 9, flexShrink: 0 }, Dim('')),
              Line(
                T({ color: C.up }, '━'.repeat(thinLen(b.up / all, inner - 9))),
                T({ color: C.down }, '━'.repeat(thinLen(b.down / all, inner - 9))),
              ),
            ),
          ]
        }),
      ),
      rank(
        '値上がり率',
        rk.up,
        (x) => pct(x.m?.chgPct, 1),
        (x) => tone(x.m?.chgPct),
        true,
      ),
      rank(
        '値下がり率',
        rk.down,
        (x) => pct(x.m?.chgPct, 1),
        (x) => tone(x.m?.chgPct),
        false,
      ),
      rank(
        '売買代金',
        rk.turnover,
        (x) => (x.m?.turnover == null ? '—' : `${fmt(x.m.turnover / 1e8)}億`),
        () => C.text2,
        false,
      ),
    ),
  )
}

export function Holdings(p: ScreenProps) {
  const C = ui.C
  const mask = ui.mask
  const { groups, total } = holdingGroups(p.r)
  const W = { code: 8, qty: 7, cost: 9, price: 10, val: 12, today: 10, pnl: 11, rate: 8, share: 8, div: 10, yoc: 11 }
  // 狭いときは右の列から落とす（銘柄は 10 桁以上）
  const shown = ['qty', 'cost', 'price', 'val', 'today', 'pnl', 'rate', 'share', 'div', 'yoc'] as Array<keyof typeof W>
  const need = () => W.code + shown.reduce((x, c) => x + W[c], 0)
  for (const d of ['share', 'cost', 'today', 'yoc', 'qty', 'div'] as const)
    if (need() + 10 > p.width - 4 && shown.includes(d)) shown.splice(shown.indexOf(d), 1)
  const nameW = Math.max(10, Math.min(30, p.width - 4 - need()))
  const label: Record<string, string> = {
    qty: '数量',
    cost: '取得単価',
    price: '現在値',
    val: '評価額',
    today: '今日',
    pnl: '含み損益',
    rate: '率',
    share: '構成比',
    div: '配当/年',
    yoc: '取得利回り',
  }
  type Sum = typeof total
  const sumCells = (s: Sum) =>
    shown.map((c) => {
      switch (c) {
        case 'val':
          return h(Num, { key: c, v: money(s.value, mask), width: W.val, bold: true })
        case 'today':
          return h(Num, { key: c, v: money(s.today, mask, true), width: W.today, color: tone(s.today) })
        case 'pnl':
          return h(Num, { key: c, v: money(s.pnl, mask, true), width: W.pnl, color: tone(s.pnl) })
        case 'rate':
          return h(Num, { key: c, v: s.cost ? pct((s.pnl / s.cost) * 100, 1) : '—', width: W.rate, color: tone(s.pnl) })
        case 'share':
          return h(Num, { key: c, v: total.value ? `${Math.round((s.value / total.value) * 100)}%` : '—', width: W.share, color: C.text2 })
        case 'div':
          return h(Num, { key: c, v: money(s.divNet, mask), width: W.div, color: C.gold })
        case 'yoc':
          return h(Num, { key: c, v: s.cost ? `${((s.div / s.cost) * 100).toFixed(2)}%` : '—', width: W.yoc, color: C.text2 })
        default:
          return h(Box, { key: c, width: W[c], flexShrink: 0 })
      }
    })
  const items = groups.flatMap((g) => g.lines)
  const sel = selIndex(p.s, items)
  const rows: React.ReactNode[] = []
  let selLine = 0
  for (const g of groups) {
    rows.push(
      h(
        Box,
        { key: `g${g.acct}`, height: 1, flexShrink: 0 },
        h(Box, { width: W.code + nameW, flexShrink: 0 }, Line(Badge(g.label, isNisa(g.acct) ? C.ok : C.text2), Dim(`  ${g.sum.n} 銘柄`))),
        ...sumCells(g.sum),
      ),
    )
    for (const l of g.lines) {
      const on = items.indexOf(l) === sel
      if (on) selLine = rows.length
      rows.push(
        h(
          Box,
          { key: l.key, height: 1, flexShrink: 0, backgroundColor: on ? C.select : undefined },
          h(Box, { width: W.code, flexShrink: 0 }, Mark(on), T({ color: C.text2 }, l.h.code)),
          h(Box, { width: nameW, paddingRight: 1, flexShrink: 0 }, T({ bold: on, wrap: 'truncate' }, l.row.name)),
          ...shown.map((c) => {
            switch (c) {
              case 'qty':
                return h(Num, { key: c, v: mask ? '••' : fmt(l.h.quantity), width: W.qty, color: C.text2 })
              case 'cost':
                return h(Num, { key: c, v: px(l.h.avgCost), width: W.cost, color: C.text2 })
              case 'price':
                return h(Num, { key: c, v: px(l.close), width: W.price, bold: true, flash: p.flashes[l.row.id] })
              case 'val':
                return h(Num, { key: c, v: l.value == null ? '—' : money(l.value, mask), width: W.val })
              case 'today':
                return h(Num, { key: c, v: l.today == null ? '—' : money(l.today, mask, true), width: W.today, color: tone(l.today) })
              case 'pnl':
                return h(Num, { key: c, v: l.pnl == null ? '—' : money(l.pnl, mask, true), width: W.pnl, color: tone(l.pnl) })
              case 'rate':
                return h(Num, { key: c, v: pct(l.rate, 1), width: W.rate, color: tone(l.rate) })
              case 'share':
                return h(Num, { key: c, v: l.share == null ? '—' : `${l.share.toFixed(1)}%`, width: W.share, color: C.text2 })
              case 'div':
                return h(Num, { key: c, v: l.divNet == null ? '—' : money(l.divNet, mask), width: W.div, color: C.gold })
              case 'yoc':
                return h(Num, { key: c, v: l.yoc == null ? '—' : `${l.yoc.toFixed(2)}%`, width: W.yoc, color: C.text2 })
            }
            return null
          }),
        ),
      )
    }
  }
  const vis = Math.max(1, p.height - 6)
  const [a, b] = windowed(rows.length, selLine, vis)
  return h(
    Card,
    {
      title: '保有',
      right: `${items.length} 銘柄 · 配当/年は特定・一般は税引後 · ${rows.length ? `${a + 1}–${b} / ${rows.length} 行` : ''}`,
      height: p.height,
    },
    h(
      Box,
      { height: 1, flexShrink: 0 },
      h(Box, { width: W.code, flexShrink: 0 }, Dim(' コード')),
      h(Box, { width: nameW, flexShrink: 0 }, Dim('銘柄')),
      ...shown.map((c) => h(Num, { key: c, v: label[c] ?? '', width: W[c], color: C.text3 })),
    ),
    ...rows.slice(a, b),
    ...(items.length ? [] : [Dim('保有がありません（アプリで証券会社の CSV を取り込むと、ここに出ます）')]),
    h(
      Box,
      {
        height: 2,
        borderStyle: 'single',
        borderTop: true,
        borderBottom: false,
        borderLeft: false,
        borderRight: false,
        borderColor: C.line,
        flexShrink: 0,
      },
      h(Box, { width: W.code + nameW, flexShrink: 0 }, Line(T({ bold: true }, ' 合計'), Dim(`  ${total.n} 銘柄`))),
      ...sumCells(total),
    ),
  )
}

export function Folio(p: ScreenProps) {
  const C = ui.C
  const mask = ui.mask
  const f = folioSummary(p.r)
  const rows = contribRows(p.r, p.s.cperiod)
  const sel = selIndex(p.s, rows)
  const ev = events(p.r)
  const [plabel, n] = PERIODS[p.s.period]!
  const { points: pts, ret: periodRet } = folioHist(p.r, n)
  const bottomH = Math.max(6, Math.min(rows.length, 10) + 3)
  const histH = Math.max(6, p.height - 5 - bottomH)
  const chartRows = Math.max(1, histH - 5)
  const chartW = Math.max(10, p.width - 4 - 12)
  const ch = areaChart(
    pts.map((x) => x.value),
    chartW,
    chartRows,
  )
  const [mark, label] = dateAxis(
    pts.map((x) => x.d),
    chartW,
  )
  const axis: (string | null)[] = new Array(chartRows).fill(null)
  for (const v of niceTicks(ch.lo, ch.hi, Math.max(2, Math.floor(chartRows / 2)))) axis[ch.rowOf(v)] ??= `┤ ${man(v, mask)}`
  const maxAbs = Math.max(1, ...rows.map((x) => Math.abs(x.amount)))
  const eventW = Math.min(46, Math.floor(p.width * 0.4))
  const half = Math.max(4, Math.floor((p.width - eventW - 4 - 1 - 24 - 11 - 2) / 2))
  const vis = Math.max(1, bottomH - 3)
  const [a, b] = windowed(rows.length, sel, vis)
  const big = (s: string, c = C.text) => T({ color: c, bold: true }, s)
  return h(
    Box,
    { flexDirection: 'column', height: p.height },
    h(
      Box,
      { height: 5, flexShrink: 0 },
      h(
        Card,
        { title: '評価額（現金を除く）', grow: true },
        Line(
          big(`${money(f.value, mask)}円`),
          T(
            { color: tone(f.today) },
            `   今日 ${money(f.today, mask, true)}（${pct(f.value - f.today ? (f.today / (f.value - f.today)) * 100 : null)}）`,
          ),
          Dim('   日経平均 '),
          T({ color: tone(f.n225) }, pct(f.n225)),
          Dim('  TOPIX連動ETF '),
          T({ color: tone(f.topix) }, pct(f.topix)),
        ),
        Line(
          Dim('含み損益 '),
          T({ color: tone(f.pnl) }, `${money(f.pnl, mask, true)}（${pct(f.cost ? (f.pnl / f.cost) * 100 : null, 1)}）`),
          Dim('   トータル損益 '),
          T({ color: tone(f.totalPnl) }, money(f.totalPnl, mask, true)),
          Dim('   最高値から '),
          T({ color: tone(f.fromPeak) }, pct(f.fromPeak, 1)),
          Dim('   取得額 '),
          T({ color: C.text2 }, money(f.cost, mask)),
        ),
      ),
      h(
        Card,
        { title: '配当（税引後）', width: Math.min(44, Math.floor(p.width * 0.36)) },
        Line(
          Dim('年間の見込み '),
          big(`${money(f.divNet, mask)}円`, C.gold),
          Dim('  前年比 '),
          T({ color: tone(f.divYoy) }, pct(f.divYoy, 1)),
        ),
        Line(
          Dim('取得利回り '),
          T({}, f.yoc == null ? '—' : `${f.yoc.toFixed(2)}%`),
          Dim('  今の利回り '),
          T({}, f.yieldNow == null ? '—' : `${f.yieldNow.toFixed(2)}%`),
        ),
      ),
    ),
    h(
      Card,
      {
        title: '資産推移',
        right: `${PERIODS.map(([x], i) => (i === p.s.period ? `[${x}]` : x)).join(' ')} · ${plabel} の騰落（入出金を除く） ${pct(periodRet, 1)}`,
        height: histH,
      },
      ...(pts.length > 1
        ? [
            ...ch.rows.map((cells, ri) =>
              h(Box, { key: ri, height: 1, flexShrink: 0 }, h(AreaRow, { cells }), T({ color: C.text3 }, axis[ri] ? ` ${axis[ri]}` : ' │')),
            ),
            h(Box, { key: 'm', height: 1, flexShrink: 0 }, T({ color: C.line }, `${mark}─┘`)),
            h(Box, { key: 'l', height: 1, flexShrink: 0 }, Dim(label)),
          ]
        : [Dim('資産推移の記録がまだありません（アプリが毎日の更新で記録します）')]),
    ),
    h(
      Box,
      { height: bottomH, flexShrink: 0 },
      h(
        Card,
        { title: `損益寄与（${CONTRIB[p.s.cperiod]}）`, right: `${CONTRIB_LABEL} · c で期間`, grow: true },
        ...rows
          .slice(a, b)
          .map((x, i) =>
            h(
              Box,
              { key: x.key, height: 1, flexShrink: 0, backgroundColor: a + i === sel ? C.select : undefined },
              Mark(a + i === sel),
              h(Box, { width: 24, paddingRight: 1, flexShrink: 0 }, T({ wrap: 'truncate' }, `${x.row.code} ${x.row.name}`)),
              h(Num, { v: money(x.amount, mask, true), width: 11, color: tone(x.amount) }),
              T({}, ' '),
              h(
                Box,
                { width: half, justifyContent: 'flex-end', flexShrink: 0 },
                x.amount < 0 ? T({ color: C.down }, '━'.repeat(thinLen(-x.amount / maxAbs, half))) : T({}, ''),
              ),
              T({ color: C.text3 }, '│'),
              h(
                Box,
                { width: half, flexShrink: 0 },
                x.amount > 0 ? T({ color: C.up }, '━'.repeat(thinLen(x.amount / maxAbs, half))) : T({}, ''),
              ),
            ),
          ),
        ...(rows.length ? [] : [Dim('保有がありません')]),
      ),
      h(
        Card,
        { title: '今後 30 日の予定', width: eventW },
        ...ev
          .slice(0, bottomH - 3)
          .map((e) =>
            h(
              Text,
              { key: `${e.date}${e.kind}${e.row.code}`, wrap: 'truncate-end' },
              T({ color: C.text2 }, `${md(e.date)}  `),
              T({ color: e.kind === '権利付最終日' ? C.gold : C.text2 }, e.kind),
              T({}, `  ${e.row.code} ${e.row.name}`),
            ),
          ),
        ...(ev.length ? [] : [Dim('予定はありません')]),
      ),
    ),
  )
}

/** 面のチャートの 1 行（同じ色の続きをまとめる） */
function AreaRow(p: { cells: [string, string | null][] }) {
  const C = ui.C
  const color = (role: string | null) => (role === 'area' ? C.area : role === 'top' ? C.areaTop : role === 'mark' ? C.yield : undefined)
  const runs: { s: string; c: string | undefined }[] = []
  for (const [ch, role] of p.cells) {
    const c = color(role)
    const last = runs.at(-1)
    if (last && last.c === c) last.s += ch
    else runs.push({ s: ch, c })
  }
  return h(Box, { flexShrink: 0 }, Line(...runs.map((x, i) => T({ key: i, color: x.c }, x.s))))
}

export function Detail(p: ScreenProps) {
  const C = ui.C
  const mask = ui.mask
  const d = p.s.detail!
  const id = `JP:${d.code}`
  const r = p.r
  const ins = r.instrument(id)
  const m = r.metrics().get(id)
  const st = r.settings()
  const tf = (['D', 'W', 'M'] as const)[p.s.tf]!
  const [plabel, days] = PERIODS[p.s.period]!
  const n = tf === 'D' ? days : tf === 'W' ? Math.ceil(days / 5) : Math.ceil(days / 21)
  const bars = r.bars(id, tf)
  const v = bars.close.slice(-n)
  const dates = bars.time.slice(-n)
  const ret = v.length > 1 ? (v.at(-1)! / v[0]! - 1) * 100 : null
  const reit = ins?.kind === 'reit'
  const targets = yieldLines(m, st)
  const held = r
    .holdings()
    .filter((x) => x.code === d.code && x.quantity > 0)
    .map((x) => lineOf(r, x))
  const alerts = r.alerts().filter((a) => a.target.kind === 'symbol' && a.target.id === id)
  const infoH = 7
  const chartRows = Math.max(3, p.height - infoH - 6)
  const chartW = Math.max(10, p.width - 4 - 18)
  const ch = areaChart(v, chartW, chartRows, targets)
  const [mark, label] = dateAxis(dates, chartW)
  // 右の軸: 今の株価 > 目標利回りの線 > きりのよい目盛り
  const axis: (React.ReactNode | null)[] = new Array(chartRows).fill(null)
  for (const t of niceTicks(ch.lo, ch.hi, Math.max(2, Math.floor(chartRows / 3)))) axis[ch.rowOf(t)] ??= T({ color: C.text3 }, `┤ ${px(t)}`)
  for (const t of targets)
    if (t.price > ch.lo && t.price < ch.hi) axis[ch.rowOf(t.price)] = T({ color: C.yield }, `┤ ${t.label} ${px(t.price)}`)
  if (m?.close != null && v.length) axis[ch.rowOf(m.close)] = T({ backgroundColor: C.chip, color: C.text, bold: true }, `◀ ${px(m.close)}`)
  const out = targets.filter((t) => !(t.price > ch.lo && t.price < ch.hi))
  const fav = r
    .watchlists()
    .find((w) => w.builtin === 'favorites')
    ?.items.includes(id)
  const divs = r.dividends(id).slice(-3)
  const lo52 = m?.lo52
  const hi52 = m?.hi52
  const g = lo52 != null && hi52 != null && m?.close != null && hi52 > lo52 ? gauge((m.close - lo52) / (hi52 - lo52), 20) : null
  return h(
    Box,
    { flexDirection: 'column', height: p.height },
    h(
      Card,
      {
        title: `${d.code}  ${ins?.nameJa ?? d.code}`,
        right: `${reit ? 'REIT' : ins?.kind === 'etf' ? 'ETF' : (ins?.sectorJa ?? '')}${m?.recordMonths.length ? ` · 権利 ${m.recordMonths.join('・')}月` : ''}`,
        focus: true,
        height: p.height - infoH,
      },
      Line(
        T({ bold: true, backgroundColor: p.flashes[id] ? (p.flashes[id]! > 0 ? C.upBg : C.downBg) : undefined }, px(m?.close)),
        T({ color: tone(m?.chg) }, `  ${m?.chg != null ? signed(Math.round(m.chg * 10) / 10) : '—'}（${pct(m?.chgPct)}）`),
        T({}, '  '),
        m?.provisional ? Badge('仮', C.warn) : Badge('確定', C.text3),
        Dim(`  ${md(m?.asOf)}   `),
        fav ? Badge('お気に入り', C.gold) : T({}, ''),
        Dim('   '),
        T({ bold: true }, TFS[p.s.tf]!),
        Dim(' · '),
        T({ bold: true }, `${plabel} の騰落 `),
        T({ color: tone(ret) }, pct(ret, 1)),
        out.length ? Dim(`   範囲の外: ${out.map((t) => `${t.label} ${px(t.price)}`).join('  ')}`) : T({}, ''),
      ),
      ...(v.length > 1
        ? [
            ...ch.rows.map((cells, ri) =>
              h(Box, { key: ri, height: 1, flexShrink: 0 }, h(AreaRow, { cells }), T({}, ' '), axis[ri] ?? T({ color: C.text3 }, '│')),
            ),
            h(Box, { key: 'm', height: 1, flexShrink: 0 }, T({ color: C.line }, `${mark}─┘`)),
            h(Box, { key: 'l', height: 1, flexShrink: 0 }, Dim(label)),
          ]
        : [Dim('足がありません（アプリで取得すると出ます）')]),
    ),
    h(
      Box,
      { height: infoH, flexShrink: 0 },
      h(
        Card,
        { title: '指標', grow: true },
        Line(
          Dim('実績利回り '),
          T({ color: C.yield, bold: true }, m?.yieldTrailing == null ? '—' : `${m.yieldTrailing.toFixed(2)}%`),
          Dim(reit ? '   分配金(12か月) ' : '   配当(12か月) '),
          T({}, m?.div12 == null ? '—' : `${fmt(m.div12, m.div12 < 100 ? 1 : 0)}円`),
          Dim('   PER '),
          T({ color: C.text2 }, reit || m?.per == null ? '—' : m.per.toFixed(1)),
          Dim('   PBR '),
          T({ color: C.text2 }, m?.pbr == null ? '—' : m.pbr.toFixed(2)),
          Dim('   連続増配 '),
          T({}, m?.divUpYears == null ? '—' : `${m.divUpYears}年`),
        ),
        Line(
          Dim('目標利回り '),
          ...(targets.length
            ? targets.flatMap((t) => [
                T({ key: `a${t.label}`, color: C.yield }, ` ${t.label} `),
                T({ key: `b${t.label}` }, px(t.price)),
                T({ key: `c${t.label}`, color: C.text3 }, `（${pct(t.gap, 1)}）`),
              ])
            : [Dim(st.yieldLine ? '—（配当なし・上場 12 か月未満）' : '—（アプリの設定で目標利回りの線を ON にすると出ます）', 'nt')]),
        ),
        Line(
          Dim('52週 '),
          T({ color: C.text2 }, `${px(lo52)} `),
          ...(g
            ? [T({ key: 'gl', color: C.text3 }, g.left), T({ key: 'gd', color: C.focus }, '●'), T({ key: 'gr', color: C.text3 }, g.right)]
            : [Dim('—', 'gn')]),
          T({ color: C.text2 }, ` ${px(hi52)}`),
          Dim('   25日線 '),
          T({ color: tone(m?.maDev25) }, pct(m?.maDev25, 1)),
          Dim('  75日線 '),
          T({ color: tone(m?.maDev75) }, pct(m?.maDev75, 1)),
        ),
        Line(
          Dim(reit ? '分配金 ' : '配当   '),
          ...(divs.length
            ? divs.map((x) =>
                T({ key: x.date, color: C.text2 }, ` ${x.date.slice(0, 7).replace('-', '/')} ${fmt(x.amount, x.amount < 100 ? 1 : 0)}`),
              )
            : [Dim('—', 'nd')]),
        ),
      ),
      h(
        Card,
        { title: '保有・アラート', width: Math.min(46, Math.floor(p.width * 0.4)) },
        ...(held.length
          ? held.map((x) =>
              h(
                Text,
                { key: x.key, wrap: 'truncate-end' },
                Badge(ACCOUNT_LABEL[x.h.account], isNisa(x.h.account) ? C.ok : C.text2),
                Dim(` ${mask ? '••' : fmt(x.h.quantity)} 取得 `),
                T({}, px(x.h.avgCost)),
                T({ color: tone(x.pnl) }, `  ${pct(x.rate, 1)} `),
                T({ color: tone(x.pnl) }, x.pnl == null ? '—' : money(x.pnl, mask, true)),
              ),
            )
          : [Dim('保有なし', 'nh')]),
        ...(alerts.length
          ? alerts
              .slice(0, 2)
              .map((a) =>
                h(
                  Text,
                  { key: a.id, wrap: 'truncate-end' },
                  Badge('アラート', a.state.met ? C.warn : C.text3),
                  Dim(a.state.met ? ' 成立中 ' : a.enabled ? ' ' : ' 停止中 '),
                  T({}, (a.adjusted ?? a.conditions).map((c) => `${c.field} ${c.op} ${c.value}`).join(' かつ ')),
                  a.distance ? Dim(`  まで ${distance(a.distance)}`) : T({}, ''),
                ),
              )
          : [Dim('アラートなし', 'na')]),
      ),
    ),
  )
}

export function Help(p: { height: number }) {
  const rows: [string, string][] = [
    ['1〜5 / Tab', '画面を切り替える'],
    ['↑↓  PgUp PgDn', '行を選ぶ（格子では ← → も）'],
    ['Enter', '選んだ銘柄の詳細を開く'],
    ['Backspace / Esc', '詳細から戻る'],
    ['n N', '詳細で、元の一覧の次・前の銘柄'],
    ['/', 'コードを打って詳細を開く'],
    ['[ ]', 'スクリーン・リストを切り替える'],
    ['v', '表と格子を切り替える（スクリーナー・ウォッチリスト）'],
    ['s', '並べ替える（スクリーナー・ウォッチリスト）'],
    [', .', '期間（3M 6M 1Y 5Y）'],
    ['t', '時間軸（日足・週足・月足）'],
    ['c', '損益寄与の期間（今日・今月・今年・取得来）'],
    ['m', '金額を隠す・出す'],
    ['r', 'すぐ読み直す'],
    ['q', '終了'],
  ]
  return h(
    Card,
    { title: 'キー', right: '何かキーを押すと閉じる', height: p.height },
    ...rows
      .slice(0, Math.max(1, p.height - 4))
      .map(([k, s]) =>
        h(Box, { key: k, height: 1 }, h(Box, { width: 20, flexShrink: 0 }, Kbd(k)), T({ color: ui.C.text2, wrap: 'truncate' }, s)),
      ),
    Dim('値は elecxstock が取得したときのもの（リアルタイムではありません）'),
  )
}
