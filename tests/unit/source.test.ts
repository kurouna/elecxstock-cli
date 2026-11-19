// 読み口: データの場所の決め方・読み取り専用の DB・利用者のデータの読み方（壊れていても動かさない）
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Db } from '@core/db'
import { STORE_VERSION } from '@core/userstore'
import { describe, expect, it } from 'vitest'
import { DB_VERSION, DbVersionError, openDb } from '../../src/source/db'
import { resolveDataDir } from '../../src/source/paths'
import { readAlertHistory, readSettings, readUser } from '../../src/source/user'
import { copySeed } from '../support/copy'

describe('データの場所', () => {
  const base = { env: {}, platform: 'win32' as const, home: 'C:\\Users\\u', appData: 'C:\\Users\\u\\AppData\\Roaming' }
  it('--data があればそれ、次に ELECXSTOCK_USER_DATA の data、無ければアプリと同じ userData の data', () => {
    expect(resolveDataDir({ ...base, arg: 'D:\\x' }).dir).toBe('D:\\x')
    expect(resolveDataDir({ ...base, env: { ELECXSTOCK_USER_DATA: 'E:\\ud' } }).dir).toBe(join('E:\\ud', 'data'))
    expect(resolveDataDir(base).dir).toBe(join('C:\\Users\\u\\AppData\\Roaming', 'elecxstock', 'data'))
  })
  it('macOS・Linux の userData', () => {
    expect(resolveDataDir({ ...base, platform: 'darwin', home: '/Users/u' }).dir).toBe(
      join('/Users/u', 'Library', 'Application Support', 'elecxstock', 'data'),
    )
    expect(resolveDataDir({ ...base, platform: 'linux', home: '/home/u' }).dir).toBe(join('/home/u', '.config', 'elecxstock', 'data'))
    expect(resolveDataDir({ ...base, platform: 'linux', home: '/home/u', env: { XDG_CONFIG_HOME: '/cfg' } }).dir).toBe(
      join('/cfg', 'elecxstock', 'data'),
    )
  })
  it('探した場所の一覧を返す（見つからないときに出す）', () => {
    const r = resolveDataDir({ ...base, env: { ELECXSTOCK_USER_DATA: 'E:\\ud' } })
    expect(r.tried).toEqual([join('E:\\ud', 'data')])
  })
})

describe('読み取り専用の DB', () => {
  it('知っている DB の版は、アプリ（v0.1.14）の移行の数と同じ', () => {
    const d = mkdtempSync(join(tmpdir(), 'elecxstock-cli-db-'))
    const db = new Db(join(d, 'market.db'))
    const v = Number((db.raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
    db.raw.close()
    rmSync(d, { recursive: true, force: true })
    expect(DB_VERSION).toBe(v)
  })
  it('書こうとしても SQLite が拒む（DB は変わらない）', () => {
    const s = copySeed()
    try {
      const db = openDb(join(s.dir, 'market.db'))
      expect(() => db.raw.exec("UPDATE metrics SET close = 1 WHERE id = 'JP:8951'")).toThrow(/readonly/i)
      db.close()
    } finally {
      s.dispose()
    }
  })
  it('DB の版が違えば DbVersionError で止める', () => {
    const s = copySeed()
    try {
      const w = new DatabaseSync(join(s.dir, 'market.db'))
      w.exec(`PRAGMA user_version = ${DB_VERSION + 1}`)
      w.close()
      expect(() => openDb(join(s.dir, 'market.db'))).toThrow(DbVersionError)
    } finally {
      s.dispose()
    }
  })
  it('data_version は、ほかの接続が書いたときだけ変わる', () => {
    const s = copySeed()
    try {
      const db = openDb(join(s.dir, 'market.db'))
      const v0 = db.dataVersion()
      expect(db.dataVersion()).toBe(v0)
      const w = new DatabaseSync(join(s.dir, 'market.db'))
      w.exec("UPDATE metrics SET close = 2 WHERE id = 'JP:8951'")
      w.close()
      expect(db.dataVersion()).not.toBe(v0)
      db.close()
    } finally {
      s.dispose()
    }
  })
})

describe('利用者のデータ', () => {
  it('設定は既定値と浅く混ぜる（アプリと同じ）。無ければ既定値', () => {
    const s = copySeed()
    try {
      const st = readSettings(join(s.dir, 'user'))
      expect(st.value.yieldLine).toBe(true)
      expect(st.value.yieldTargets).toEqual([4, 5.5])
      rmSync(join(s.dir, 'user', 'settings.json'))
      expect(readSettings(join(s.dir, 'user')).value.yieldLine).toBe(false)
    } finally {
      s.dispose()
    }
  })
  it('壊れたファイルは「読めなかった」と返し、移動も退避もしない', () => {
    const s = copySeed()
    try {
      const u = join(s.dir, 'user')
      writeFileSync(join(u, 'watchlists.json'), '{broken')
      const backups = existsSync(join(u, 'backups')) ? readdirSync(join(u, 'backups')).length : 0
      const r = readUser(u, 'watchlists')
      expect(r.error).toBeTruthy()
      expect(existsSync(join(u, 'watchlists.json'))).toBe(true)
      expect(existsSync(join(u, 'backups')) ? readdirSync(join(u, 'backups')).length : 0).toBe(backups)
    } finally {
      s.dispose()
    }
  })
  it('新しい版のファイルは読まずに止める', () => {
    const s = copySeed()
    try {
      const u = join(s.dir, 'user')
      writeFileSync(join(u, 'holdings.json'), JSON.stringify({ version: STORE_VERSION + 1, data: [] }))
      expect(readUser(u, 'holdings').error).toMatch(/version/)
    } finally {
      s.dispose()
    }
  })
  it('鳴ったアラートの履歴を読む（未読の数）', () => {
    const s = copySeed()
    try {
      const h = readAlertHistory(join(s.dir, 'user'))
      expect(h.filter((f) => !f.read)).toHaveLength(1)
    } finally {
      s.dispose()
    }
  })
})
