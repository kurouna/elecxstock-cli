// 架空のデータ（elecxstock のスタブのプロバイダ）で、アプリと同じ形の data フォルダを作る。テストの種と、手で動かすとき（npm run fixture）に使う。
// アプリの Core（CoreService）で作るので、DB の版・表・利用者のデータの形はアプリと同じ。値はすべて架空（実際の市場データは使わない）
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createStubProvider } from '@core/providers/stub'
import { CoreService } from '@core/service'
import { TEST_NOW } from '@shared/clock'
import type { AlertFire, Holding } from '@shared/types'
// @ts-expect-error: elecxstock のデモ用の .mjs（型なし）
import { HOLD, history } from '../../vendor/elecxstock/scripts/folio-fixture.mjs'

/** 監視用のウォッチリスト（架空の並び。コードは実在） */
export const WATCH = ['8951', '8058', '7203', '8306', '6501', '2914', '9434', '8766']
export const CANDIDATES = ['4063', '8053', '9434']

/** dir（アプリの userData の data フォルダにあたる）に、初回の取り込みを済ませた DB と利用者のデータを作る */
export async function buildFixture(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  const Real = Date
  const offset = Date.parse(TEST_NOW) - Real.now()
  // この処理の間だけ時刻を基準日時にずらす
  globalThis.Date = new Proxy(Real, {
    construct: (t, a, nt) => Reflect.construct(t, a.length === 0 ? [Real.now() + offset] : a, nt),
    get: (t, p, r) => (p === 'now' ? () => Real.now() + offset : Reflect.get(t, p, r)),
  }) as DateConstructor
  try {
    const svc = new CoreService(dir, createStubProvider(), () => {}, 'fixture')
    const idle = async () => {
      for (let i = 0; i < 6000; i++) {
        const jobs = await svc.call('jobs.list', {})
        if (jobs.every((j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled')) return
        await new Promise((r) => setTimeout(r, 20))
      }
    }
    await svc.call('jobs.start', { kind: 'initial' })
    await idle()
    const u = await svc.call('user.load', {})
    await svc.call('user.saveSettings', {
      settings: { ...u.settings, yieldLine: true, yieldTargets: [4, 5.5], disclaimerAccepted: true, firstRunDone: true },
    })
    const lists = u.watchlists.map((w) =>
      w.builtin === 'favorites'
        ? { ...w, items: WATCH.map((c) => `JP:${c}`) }
        : w.builtin === 'candidates'
          ? { ...w, items: CANDIDATES.map((c) => `JP:${c}`) }
          : w.id === 'income'
            ? { ...w, items: ['JP:8951', 'JP:3462', 'JP:2914', 'JP:8058', 'JP:8766'] }
            : w,
    )
    await svc.call('user.saveWatchlists', { watchlists: lists })
    await svc.call('portfolio.save', { holdings: HOLD.map((h: Holding) => ({ ...h, broker: 'rakuten' })) })
    await svc.call('alerts.save', {
      alert: {
        id: 'al-1',
        target: { kind: 'symbol', id: 'JP:8306' },
        conditions: [{ field: 'price.close', op: '>=', value: 1 }],
        basis: TEST_NOW.slice(0, 10),
        repeat: true,
        enabled: true,
        created: TEST_NOW,
      },
    } as never)
    await idle()
    // 資産推移の記録（約 1 年半。今日の評価額 ÷ 取得額の比につなぐ）
    const today = (await svc.call('folio.series', {})).points.at(-1)
    const end = today ? today.value / today.cost : 1.05
    await svc.shutdown()
    writeFileSync(join(dir, 'user', 'portfolioHistory.json'), JSON.stringify({ version: 1, data: history(end, TEST_NOW.slice(0, 10)) }))
    // 鳴ったアラートの履歴（未読 1 件）
    const fire: AlertFire = {
      id: 'af-1',
      alertId: 'al-1',
      at: TEST_NOW,
      instrument: 'JP:8306',
      conditions: [{ field: 'price.close', op: '>=', value: 1 }],
      values: {},
      splitAdjusted: false,
      asOf: TEST_NOW.slice(0, 10),
      provisional: false,
      read: false,
    } as AlertFire
    writeFileSync(join(dir, 'user', 'alertHistory.json'), JSON.stringify({ version: 1, data: [fire] }))
    // もう一度起動して、アプリと同じく今日の点を記録させる（起動の 80ms 後に記録する）
    const again = new CoreService(dir, createStubProvider(), () => {}, 'fixture')
    await new Promise((r) => setTimeout(r, 500))
    await again.shutdown()
  } finally {
    globalThis.Date = Real
  }
}
