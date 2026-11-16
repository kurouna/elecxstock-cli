// アプリと数字がずれない: elecxstock の CoreService から写した材料で作った値が、同じ DB から CoreService が返す値と同じ
import { createStubProvider } from '@core/providers/stub'
import { CoreService } from '@core/service'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Reader } from '../../src/source/reader'
import { copySeed } from '../support/copy'

let svc: CoreService
let reader: Reader
let disposeA: () => void
let disposeB: () => void
beforeAll(async () => {
  // CoreService は開くと書くので、Reader とは別の写しで作る
  const a = copySeed()
  const b = copySeed()
  disposeA = a.dispose
  disposeB = b.dispose
  svc = new CoreService(a.dir, createStubProvider(), () => {}, 'test')
  reader = new Reader(b.dir)
})
afterAll(async () => {
  await svc.shutdown().catch(() => {})
  reader.close()
  disposeA()
  disposeB()
})

describe('アプリと同じ値', () => {
  it('保有（分割で換算した数量・取得単価）', async () => {
    expect(reader.holdings()).toEqual(await svc.call('portfolio.list', {}))
  })
  it('指標（基準日が古い印を含む）', async () => {
    const ids = ['JP:8951', 'JP:8306', 'IDX:N225']
    const mine = ids.map((id) => reader.metrics().get(id))
    expect(mine).toEqual(await svc.call('metrics.get', { ids }))
  })
  it('日足・週足・月足（分割調整）', async () => {
    for (const tf of ['D', 'W', 'M'] as const) {
      const a = reader.bars('JP:8951', tf)
      const b = await svc.call('bars.get', { id: 'JP:8951', tf, adjustment: 'split' })
      expect(a.close).toEqual(b.close)
      expect(a.time).toEqual(b.time)
    }
  })
  it('資産推移・損益寄与・配当', async () => {
    expect(reader.folioSeries().points).toEqual((await svc.call('folio.series', {})).points)
    expect(reader.folioContrib('month')).toEqual(await svc.call('folio.contrib', { period: 'month' }))
    expect(reader.folioContrib('year')).toEqual(await svc.call('folio.contrib', { period: 'year' }))
    expect(reader.folioDividends()).toEqual(await svc.call('folio.dividends', {}))
  })
  it('スクリーナーの結果（保存したスクリーンの件数と並び）', async () => {
    const lists = reader.watchlists()
    for (const sc of reader.screens()) {
      const mine = reader.screen(sc.conditions)
      const theirs = await svc.call('screener.run', {
        conditions: sc.conditions,
        favorites: lists.find((w) => w.builtin === 'favorites')?.items ?? [],
        watchlists: Object.fromEntries(lists.map((w) => [w.id, w.items])),
      } as never)
      expect(mine.ids, sc.name.ja).toEqual(theirs.ids)
    }
  })
  it('アラート（今の値・条件までの距離）', async () => {
    const mine = reader.alerts().map((a) => ({ id: a.id, now: a.now, distance: a.distance }))
    const theirs = (await svc.call('alerts.list', {})).map((a) => ({ id: a.id, now: a.now, distance: a.distance }))
    expect(mine).toEqual(theirs)
  })
  it('最後の更新', async () => {
    expect(reader.status().lastUpdate).toBe((await svc.call('data.status', {})).lastUpdate)
  })
})
