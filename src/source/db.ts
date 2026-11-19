// 読み取り専用の DB。elecxstock の Db（開くと移行する）は使わず、node:sqlite を readOnly で開く。
// Repo（elecxstock の表の読み方）が使う all / get / raw だけを持つ入れ物を作る
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { Db } from '@core/db'

/** 対応する DB の版（elecxstock v0.1.14 の移行の数。テストで elecxstock の Db と突き合わせる） */
export const DB_VERSION = 6

export class DbVersionError extends Error {
  constructor(
    readonly found: number,
    readonly expected: number,
  ) {
    super(`DB の版が ${found} です（この elecxstock-cli は ${expected}）。elecxstock-cli と elecxstock の版をそろえてください`)
  }
}

export interface RoDb {
  raw: DatabaseSync
  all<T>(sql: string, ...p: SQLInputValue[]): T[]
  get<T>(sql: string, ...p: SQLInputValue[]): T | undefined
  /** ほかの接続がコミットしたら変わる値（変わったかの確認に使う） */
  dataVersion(): number
  /** DB の版（PRAGMA user_version） */
  userVersion(): number
  /** elecxstock の Repo に渡す形（読むメソッドだけを呼ぶこと） */
  asDb(): Db
  close(): void
}

export function openDb(file: string): RoDb {
  const raw = new DatabaseSync(file, { readOnly: true })
  raw.exec('PRAGMA busy_timeout = 3000')
  const userVersion = () => Number((raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
  const version = userVersion()
  if (version !== DB_VERSION) {
    raw.close()
    throw new DbVersionError(version, DB_VERSION)
  }
  const stmts = new Map<string, ReturnType<DatabaseSync['prepare']>>()
  const prep = (sql: string) => {
    let s = stmts.get(sql)
    if (!s) {
      s = raw.prepare(sql)
      stmts.set(sql, s)
      if (stmts.size > 200) stmts.delete(stmts.keys().next().value!)
    }
    return s
  }
  const db: RoDb = {
    raw,
    // 読み切る（.all）。読みかけの文を残さない（アプリのチェックポイントを待たせない）
    all: <T>(sql: string, ...p: SQLInputValue[]) => prep(sql).all(...p) as T[],
    get: <T>(sql: string, ...p: SQLInputValue[]) => prep(sql).get(...p) as T | undefined,
    userVersion,
    dataVersion: () => Number((raw.prepare('PRAGMA data_version').get() as { data_version: number }).data_version),
    asDb: () => {
      const meta = (key: string) => db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null
      return { raw, all: db.all, get: db.get, meta } as unknown as Db
    },
    close: () => {
      stmts.clear()
      raw.close()
    },
  }
  return db
}
