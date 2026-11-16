// データの場所: アプリ（elecxstock の src/main/index.ts）と同じ決め方で、market.db と user\ のある data フォルダを探す
import { join } from 'node:path'

export interface PathInput {
  /** --data の値 */
  arg?: string
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
  home: string
  /** Windows の %APPDATA% */
  appData?: string
}

/** Electron の userData（アプリの名前のフォルダ） */
function userData(p: PathInput): string {
  if (p.platform === 'win32') return join(p.appData ?? join(p.home, 'AppData', 'Roaming'), 'elecxstock')
  if (p.platform === 'darwin') return join(p.home, 'Library', 'Application Support', 'elecxstock')
  return join(p.env.XDG_CONFIG_HOME ?? join(p.home, '.config'), 'elecxstock')
}

/** 使う data フォルダと、探した場所（見つからないときに出す） */
export function resolveDataDir(p: PathInput): { dir: string; tried: string[] } {
  if (p.arg) return { dir: p.arg, tried: [p.arg] }
  const dir = p.env.ELECXSTOCK_USER_DATA ? join(p.env.ELECXSTOCK_USER_DATA, 'data') : join(userData(p), 'data')
  return { dir, tried: [dir] }
}
