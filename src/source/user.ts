// 利用者のデータ（user\*.json）を読む。elecxstock の UserStore は壊れたファイルを移す・フォルダを作るので使わず、
// 同じスキーマ（USER_FILE_SCHEMAS）で確かめて読むだけにする。読めなければ「読めなかった」と返し、ファイルには触らない
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { defaultScreens, defaultWatchlists, STORE_VERSION } from '@core/userstore'
import { USER_FILE_SCHEMAS } from '@shared/api'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { AlertFire, Settings, Watchlist } from '@shared/types'
import type { z } from 'zod'

type Name = 'settings' | 'watchlists' | 'screens' | 'holdings' | 'alerts' | 'portfolioMeta'
type Value<N extends Name> = z.infer<(typeof USER_FILE_SCHEMAS)[N]>

export interface Read<T> {
  value: T
  /** 読めなかった理由（読めなければ既定値を返す） */
  error?: string
}

const DEFAULTS: { [N in Name]: () => Value<N> } = {
  settings: () => DEFAULT_SETTINGS,
  watchlists: () => defaultWatchlists(),
  screens: () => defaultScreens(),
  holdings: () => [],
  alerts: () => [],
  portfolioMeta: () => null,
}

/** 組み込みのウォッチリスト（お気に入り・売買候補）を先頭に（アプリと同じ） */
function ensureBuiltins(list: Watchlist[]): Watchlist[] {
  const out = [...list]
  for (const b of defaultWatchlists().filter((w) => w.builtin)) if (!out.some((w) => w.builtin === b.builtin)) out.unshift(b)
  return [
    ...out.filter((w) => w.builtin === 'favorites'),
    ...out.filter((w) => w.builtin === 'candidates'),
    ...out.filter((w) => !w.builtin),
  ]
}

export function readUser<N extends Name>(dir: string, n: N): Read<Value<N>> {
  const p = join(dir, `${n}.json`)
  const def = DEFAULTS[n]() as Value<N>
  const fix = (v: Value<N>) => (n === 'watchlists' ? (ensureBuiltins(v as Watchlist[]) as Value<N>) : v)
  if (!existsSync(p)) return { value: fix(def) }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as { version?: unknown; data?: unknown } | null
    const version = raw && typeof raw === 'object' && typeof raw.version === 'number' ? raw.version : 0
    if (version > STORE_VERSION) return { value: fix(def), error: `${n}.json: version ${version} > ${STORE_VERSION}` }
    const data = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw
    const parsed = USER_FILE_SCHEMAS[n].safeParse(n === 'settings' ? { ...DEFAULT_SETTINGS, ...(data as object) } : data)
    if (!parsed.success)
      return { value: fix(def), error: `${n}.json: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` }
    return { value: fix(parsed.data as Value<N>) }
  } catch (e) {
    return { value: fix(def), error: `${n}.json: ${(e as Error).message}` }
  }
}

export const readSettings = (dir: string): Read<Settings> => readUser(dir, 'settings') as Read<Settings>

/** 鳴ったアラートの履歴（アプリの AlertBook と同じ形。読めなければ空） */
export function readAlertHistory(dir: string): AlertFire[] {
  const p = join(dir, 'alertHistory.json')
  if (!existsSync(p)) return []
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as { data?: AlertFire[] }
    return Array.isArray(raw?.data) ? raw.data : []
  } catch {
    return []
  }
}

/** ファイルの更新時刻（無ければ 0）。変わったかの確認に使う */
export function mtime(p: string): number {
  try {
    return statSync(p).mtimeMs
  } catch {
    return 0
  }
}
