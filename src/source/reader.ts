// 読み口: elecxstock のデータを読み取り専用で読み、アプリと同じ形・同じ値で返す。
// 計算は elecxstock の関数をそのまま呼ぶ。CoreService の中にある材料の組み立て（folioMarket・holdings・alertViews・
// screener の入力・bars）だけを写す（docs/design.md §9）。写した処理はテスト（tests/unit/parity.test.ts）でアプリと突き合わせる
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contribOf, dividendsOf, type FolioBook, type Market, seriesResult } from '@core/folio'
import { normalize } from '@core/holdings'
import { idOf, Repo } from '@core/repo'
import { runScreen } from '@core/screener'
import { adjust, adjustMonthly, aggregate, mergeMonthly, toBars } from '@core/series'
import { adjustedConditions, distanceOf, heldFrom, nowValueOf } from '@shared/alerts'
import { folioPointSchema } from '@shared/api'
import { jstNow, lastClosedSession } from '@shared/calendar'
import { mergePoints } from '@shared/folio'
import type {
  Adjustment,
  AlertView,
  Bars,
  Condition,
  Dividend,
  FolioContrib,
  FolioDividends,
  FolioPoint,
  FolioSeries,
  Holding,
  Instrument,
  InstrumentId,
  MetricsRow,
  PortfolioMeta,
  SavedScreen,
  ScreenResult,
  Settings,
  Split,
  Timeframe,
  Watchlist,
} from '@shared/types'
import { z } from 'zod'
import { DB_VERSION, DbVersionError, openDb, type RoDb } from './db'
import { mtime, readAlertHistory, readUser } from './user'

export interface Status {
  lastUpdate: string | null
  instruments: number
  /** 読めなかった利用者のデータ（ファイル名: 理由） */
  errors: string[]
}

/** 変わったかを見る利用者のデータ（アラートの判定の状態は、取得のジョブの終わりに DB より後で書かれる） */
const WATCHED = [
  'settings',
  'watchlists',
  'screens',
  'holdings',
  'alerts',
  'alertState',
  'alertHistory',
  'portfolioHistory',
  'portfolioMeta',
] as const

export class Reader {
  readonly db: RoDb
  readonly repo: Repo
  readonly userDir: string
  private cache = new Map<string, unknown>()
  private version = ''

  constructor(readonly dataDir: string) {
    this.db = openDb(join(dataDir, 'market.db'))
    this.repo = new Repo(this.db.asDb())
    this.userDir = join(dataDir, 'user')
    this.version = this.stamp()
  }

  /**
   * データの印（DB の data_version・利用者のデータの更新時刻・今日の日付と直近の取引日）。変わったら読み直す。
   * 日付も入れるのは、日をまたいだり大引けを過ぎたりすると、古い指標の印（stale）や作りかけの足が変わるため
   */
  stamp(): string {
    const files = WATCHED.map((n) => mtime(join(this.userDir, `${n}.json`)))
    return `${this.db.dataVersion()}|${files.join(',')}|${jstNow().date}|${lastClosedSession()}`
  }
  /** 覚えた値をすべて捨てる（r で読み直す） */
  invalidate(): void {
    this.version = this.stamp()
    this.cache.clear()
  }
  /** 変わっていれば覚えた値を捨てて true。動いている間にアプリが DB の版を上げたら DbVersionError（読み続けると表の形が合わない） */
  changed(): boolean {
    const s = this.stamp()
    if (s === this.version) return false
    const v = this.db.userVersion()
    if (v !== DB_VERSION) throw new DbVersionError(v, DB_VERSION)
    this.version = s
    this.cache.clear()
    return true
  }
  private memo<T>(key: string, f: () => T): T {
    if (!this.cache.has(key)) this.cache.set(key, f())
    return this.cache.get(key) as T
  }

  // ---------------------------------------------------------------- 利用者のデータ
  private user<T>(n: 'settings' | 'watchlists' | 'screens' | 'holdings' | 'alerts' | 'portfolioMeta'): { value: T; error?: string } {
    return this.memo(`user:${n}`, () => readUser(this.userDir, n)) as { value: T; error?: string }
  }
  settings(): Settings {
    return this.user<Settings>('settings').value
  }
  watchlists(): Watchlist[] {
    return this.user<Watchlist[]>('watchlists').value
  }
  screens(): SavedScreen[] {
    return this.user<SavedScreen[]>('screens').value
  }
  /** 保有（分割で換算。アプリの portfolio.list と同じ） */
  holdings(): Holding[] {
    return this.memo('holdings', () => this.user<Holding[]>('holdings').value.map((h) => normalize(h, this.repo.splits(idOf(h.code)))))
  }
  /** 証券会社の CSV の情報（実現損益・受取配当の累計。アプリの portfolio.meta） */
  portfolioMeta(): PortfolioMeta | null {
    return this.user<PortfolioMeta | null>('portfolioMeta').value
  }
  unreadAlerts(): number {
    return this.memo('unread', () => readAlertHistory(this.userDir).filter((f) => !f.read).length)
  }

  // ---------------------------------------------------------------- 市場データ
  status(): Status {
    return this.memo('status', () => ({
      lastUpdate: this.db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', 'lastUpdate')?.value ?? null,
      instruments: this.repo.counts().instruments,
      errors: (['settings', 'watchlists', 'screens', 'holdings', 'alerts', 'portfolioMeta'] as const).flatMap(
        (n) => this.user(n).error ?? [],
      ),
    }))
  }
  /** 指標（基準日が直近の取引日より古い行に stale の印。アプリの metricsMap と同じ） */
  metrics(): Map<InstrumentId, MetricsRow> {
    return this.memo('metrics', () => {
      const session = lastClosedSession()
      return new Map(this.repo.metrics().map((m) => [m.id, { ...m, stale: !m.asOf || m.asOf < session }]))
    })
  }
  instruments(): Map<InstrumentId, Instrument> {
    return this.memo('instruments', () => new Map(this.repo.universe().map((i) => [i.id, i])))
  }
  instrument(id: InstrumentId): Instrument | null {
    return this.instruments().get(id) ?? this.repo.instrument(id)
  }
  dividends(id: InstrumentId): Dividend[] {
    return this.memo(`div:${id}`, () => this.repo.dividends(id))
  }
  splits(id: InstrumentId): Split[] {
    return this.memo(`split:${id}`, () => this.repo.splits(id))
  }
  /** 足（アプリの bars.get と同じ。月足の取り直しを頼むことはしない） */
  bars(id: InstrumentId, tf: Timeframe, adj: Adjustment = 'split'): Bars {
    return this.memo(`bars:${id}:${tf}:${adj}`, () => {
      const r = this.repo
      const today = jstNow().date
      const daily = r.daily(id)
      const splits = r.splits(id)
      const dividends = r.dividends(id)
      const adjusted = adjust(daily, adj, splits, dividends)
      if (tf === 'M') {
        const monthly = adjustMonthly(r.monthly(id), adj, splits, dividends, daily, adjusted)
        const { bars, monthlyUntil } = mergeMonthly(monthly, adjusted)
        return { ...toBars(id, 'M', bars, today, monthlyUntil), dividends, splits, adjustment: adj }
      }
      return { ...toBars(id, tf, aggregate(adjusted, tf), today), dividends, splits, adjustment: adj }
    })
  }
  /** 終値の並び（一覧の 1 年の推移。日足の最後の n 本） */
  closes(id: InstrumentId, n: number): number[] {
    return this.memo(`closes:${id}:${n}`, () => this.repo.recentDaily(id, n).map((b) => b.c))
  }

  // ---------------------------------------------------------------- スクリーナー
  private heldMap() {
    return heldFrom(this.holdings())
  }
  /** 保存したスクリーンの結果（アプリの screener.run と同じ材料） */
  screen(conditions: Condition[]): ScreenResult {
    return this.memo(`screen:${JSON.stringify(conditions)}`, () => this.runScreen(conditions))
  }
  private runScreen(conditions: Condition[]): ScreenResult {
    const lists = this.watchlists()
    return runScreen({
      conditions,
      instruments: [...this.instruments().values()],
      metrics: this.metrics(),
      favorites: new Set(lists.find((w) => w.builtin === 'favorites')?.items ?? []),
      watchlists: Object.fromEntries(lists.map((w) => [w.id, w.items])),
      holdings: this.heldMap(),
    })
  }

  // ---------------------------------------------------------------- アラート
  /** アラートの一覧の形（アプリの alertViews と同じ。判定の状態は読むだけ） */
  alerts(): AlertView[] {
    return this.memo('alerts', () => {
      const metrics = this.metrics()
      const held = this.heldMap()
      const states = this.alertStates()
      return this.user<AlertView[]>('alerts').value.map((a) => {
        const state = states[a.id] ?? { met: null }
        if (a.target.kind === 'screen') return { ...a, state, now: state.members?.length ?? null, distance: null }
        const id = a.target.id
        const m = metrics.get(id)
        const adj = adjustedConditions(a, this.repo.splits(id))
        return {
          ...a,
          state,
          now: nowValueOf(a, m, held),
          distance: distanceOf(adj ?? a.conditions, m, held, id),
          ...(adj ? { adjusted: adj } : {}),
        }
      })
    })
  }
  private alertStates(): Record<string, AlertView['state']> {
    const p = join(this.userDir, 'alertState.json')
    if (!existsSync(p)) return {}
    try {
      return (JSON.parse(readFileSync(p, 'utf8')) as { data?: Record<string, AlertView['state']> }).data ?? {}
    } catch {
      return {}
    }
  }

  // ---------------------------------------------------------------- ポートフォリオ
  /** 市場データ（日足・配当・分割）を記録と計算に渡す形（アプリの folioMarket と同じ） */
  private folioMarket(): Market {
    const r = this.repo
    const db = this.db
    return {
      closeOn: (code, d) => {
        const x = db.get<{ d: string; c: number; prov: number }>(
          'SELECT d, c, prov FROM daily_bars WHERE id = ? AND d <= ? ORDER BY d DESC LIMIT 1',
          idOf(code),
          d,
        )
        return x ? { d: x.d, c: x.c, ...(x.prov ? { prov: true } : {}) } : null
      },
      closes: (code, from) => r.daily(idOf(code), from).map((b) => ({ d: b.d, c: b.c, ...(b.prov ? { prov: true } : {}) })),
      firstBar: (code) =>
        this.memo(
          `first:${code}`,
          () => db.get<{ d: string | null }>('SELECT MIN(d) AS d FROM daily_bars WHERE id = ?', idOf(code))?.d ?? undefined,
        ),
      splits: (code) => this.splits(idOf(code)),
      dividends: (code) => this.dividends(idOf(code)),
    }
  }
  /**
   * 資産推移の記録（portfolioHistory.json。アプリの FolioBook.load と同じく、読めなければ直前の版 .bak、日付で並べて重なりを除く）。
   * ファイルには触らない（壊れた本体を移すのはアプリだけ）
   */
  folioPoints(): FolioPoint[] {
    return this.memo('folioPoints', () => {
      const read = (p: string) => {
        const raw = JSON.parse(readFileSync(p, 'utf8')) as { data?: unknown }
        return z.array(folioPointSchema).parse(raw?.data ?? raw) as FolioPoint[]
      }
      const p = join(this.userDir, 'portfolioHistory.json')
      let pts: FolioPoint[] = []
      for (const f of [p, `${p}.bak`]) {
        if (!existsSync(f)) continue
        try {
          pts = read(f)
          break
        } catch {}
      }
      return mergePoints([], pts)
    })
  }
  folioSeries(): FolioSeries {
    return this.memo('folioSeries', () => {
      const book = { load: () => this.folioPoints(), broken: undefined, warning: undefined, locked: false } as unknown as FolioBook
      return seriesResult(book, this.folioMarket(), false, true, this.holdings(), lastClosedSession())
    })
  }
  folioContrib(period: 'month' | 'year'): FolioContrib {
    return this.memo(`contrib:${period}`, () =>
      contribOf(this.folioPoints(), this.holdings(), period, lastClosedSession(), this.folioMarket()),
    )
  }
  folioDividends(): FolioDividends {
    return this.memo('folioDiv', () => dividendsOf(this.folioPoints(), this.holdings(), lastClosedSession(), this.folioMarket()))
  }

  close(): void {
    this.db.close()
  }
}
