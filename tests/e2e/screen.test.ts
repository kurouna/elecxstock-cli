// E2E: データが変わったときの読み直し・端末の幅と高さ・読み取り専用（ファイルを変えない）
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { copySeed, K, type Started, start, width } from '../support/app'

let app: Started | undefined
afterEach(() => {
  app?.stop()
  app = undefined
})

describe('データが変わったら読み直す', () => {
  it('アプリが DB に書いたら、次の確認で読み直して新しい値を出す（変わっていなければ読まない）', async () => {
    const seed = copySeed()
    try {
      app = await start({ dir: seed.dir, checkMs: 50 })
      expect(app.frame()).not.toContain('123,456')
      // アプリ（書く側）の代わりに、別の接続で指標を書き換える
      const w = new DatabaseSync(join(seed.dir, 'market.db'))
      w.prepare("UPDATE metrics SET close = 123456 WHERE id = 'JP:8951'").run()
      w.close()
      await app.until('123,456', 5000)
    } finally {
      app?.stop()
      app = undefined
      seed.dispose()
    }
  })
  it('利用者のデータ（ウォッチリスト）が変わっても読み直す', async () => {
    const seed = copySeed()
    try {
      app = await start({ dir: seed.dir, checkMs: 50 })
      const p = join(seed.dir, 'user', 'watchlists.json')
      const j = JSON.parse(readFileSync(p, 'utf8')) as { data: { builtin?: string; items: string[] }[] }
      j.data.find((w) => w.builtin === 'favorites')!.items = ['JP:8951', 'JP:8058']
      const { writeFileSync } = await import('node:fs')
      writeFileSync(p, JSON.stringify(j))
      await app.until('お気に入り 2 銘柄', 5000)
    } finally {
      app?.stop()
      app = undefined
      seed.dispose()
    }
  })
})

describe('動いている間にアプリの版が上がったとき', () => {
  it('DB の版が変わったら、落ちずに知らせて読み直しを止める（端末は描けたまま）', async () => {
    const seed = copySeed()
    try {
      app = await start({ dir: seed.dir, checkMs: 50 })
      const w = new DatabaseSync(join(seed.dir, 'market.db'))
      w.exec('PRAGMA user_version = 99')
      w.close()
      await app.until('DB の版が 99', 5000)
      expect(app.exited()).toBe(false)
      expect(app.frame()).toContain('お気に入り 8 銘柄')
    } finally {
      app?.stop()
      app = undefined
      seed.dispose()
    }
  })
  it('r で読み直すと、日付で変わる値（作りかけの足・古い指標の印）も作り直す', async () => {
    app = await start()
    const before = app.reader.metrics()
    await app.press('r')
    expect(app.reader.metrics()).not.toBe(before)
  })
})

const SIZES: [number, number][] = [
  [80, 24],
  [100, 30],
  [120, 40],
  [150, 40],
]

describe('端末の幅と高さに収まる', () => {
  for (const [w, h] of SIZES)
    it(`${w}×${h}: どの画面も行の幅が ${w} 以下、行数が ${h - 1} 以下`, async () => {
      app = await start({ width: w, height: h })
      const check = (where: string) => {
        const lines = app!.lines()
        expect(lines.length, `${where} の行数`).toBeLessThanOrEqual(h - 1)
        for (const l of lines) expect(width(l), `${where}: ${l}`).toBeLessThanOrEqual(w)
        // 行が縮んで重なると、符号や文字が混ざる（+-7.3% など）
        expect(app!.frame(), where).not.toMatch(/\+-\d|-\+\d/)
      }
      for (const t of ['1', '2', '3', '4', '5']) {
        await app.press(t)
        await new Promise((r) => setTimeout(r, 30))
        check(`画面 ${t}`)
      }
      await app.press('3', 'v')
      await new Promise((r) => setTimeout(r, 30))
      check('格子')
      await app.press('v', K.enter)
      await app.until('›')
      check('詳細')
      await app.press('?')
      check('キーの一覧')
    })
})

describe('行が重ならない（収まらない行は縮めずに切る）', () => {
  for (const [w, h] of SIZES)
    it(`${w}×${h}: マーケットの区切り（日本・米国…）は 1 行に 1 つ、騰落の棒は数字の行と別`, async () => {
      app = await start({ width: w, height: h, tab: 1 })
      await app.until('騰落')
      // 左の表の行は字下げした銘柄、字下げの無い行は区切り（日本・米国…）か見出しだけ（重なると「商品国債…」のように混ざる）
      const GROUPS = ['日本', '米国', 'アジア', '為替・金利', '商品', '暗号資産']
      for (const l of app.lines()) {
        const cell = l.split('│')[1]
        if (cell == null || !/^ S/.test(cell)) continue
        const text = cell.trim()
        if (!text.startsWith('マーケット')) expect(GROUPS, l).toContain(text)
      }
      for (const l of app.lines().filter((x) => /プライム|J-REIT/.test(x) && !x.includes('値上がり'))) expect(l).not.toContain('━')
    })
})

/** data フォルダのファイル（-wal・-shm を除く）の中身のハッシュ */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (!/-(wal|shm)$/.test(n)) out[p.slice(dir.length)] = createHash('sha256').update(readFileSync(p)).digest('hex')
    }
  }
  walk(dir)
  return out
}

describe('読み取り専用（アプリのファイルを変えない）', () => {
  it('すべての画面・詳細・格子を開いても、DB と利用者のデータの中身もファイルの数も変わらない', async () => {
    const seed = copySeed()
    try {
      const before = snapshot(seed.dir)
      app = await start({ dir: seed.dir, checkMs: 30 })
      for (const t of ['1', '2', '3', '4', '5']) await app.press(t)
      await app.press('3', K.enter, '.', 't', K.backspace, 'v', ']', 'm', '?', 'x')
      await new Promise((r) => setTimeout(r, 200))
      app.stop()
      app = undefined
      expect(snapshot(seed.dir)).toEqual(before)
    } finally {
      seed.dispose()
    }
  })
})
