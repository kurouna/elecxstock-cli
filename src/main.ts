// elecxstock-cli の入口: 引数・データの場所・起動と終了（端末を元に戻す）
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { clockOffsetFrom, shiftClock } from '@shared/clock'
import { render } from 'ink'
import React from 'react'
import { App } from './app'
import { type Args, parseArgs } from './args'
import { DB_VERSION, DbVersionError } from './source/db'
import { resolveDataDir } from './source/paths'
import { Reader } from './source/reader'
import { ELECXSTOCK_VERSION, VERSION } from './version'

const HELP = `elecxstock-cli ${VERSION} — elecxstock のデータをターミナルで眺める（読み取り専用）

使い方: elecxstock-cli [オプション]

  --data <フォルダ>   market.db と user\\ のある data フォルダ（既定はアプリと同じ場所）
  --where            使う data フォルダと DB の版を出して終わる
  --tab <1〜5>       はじめの画面（1 マーケット 2 スクリーナー 3 ウォッチリスト 4 保有 5 ポートフォリオ）
  --theme <dark|light>  端末の地が明るいときは light
  --no-color         色を使わない（NO_COLOR でも同じ）
  -v, --version      版を出す
  -h, --help         この説明

キーは画面で ? を押すと出ます。値は elecxstock が取得したときのもので、リアルタイムではありません。
`

function main(): number {
  let o: Args
  try {
    o = parseArgs(process.argv.slice(2), process.env)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (o.version) {
    process.stdout.write(`elecxstock-cli ${VERSION}（elecxstock ${ELECXSTOCK_VERSION} のデータ。DB の版 ${DB_VERSION}）\n`)
    return 0
  }
  // テスト・スクリーンショット用に時刻をずらす（elecxstock と同じ変数。スタブのデータを見るときだけ使う）
  const offset = clockOffsetFrom({ ELECXSTOCK_PROVIDER: 'stub', ELECXSTOCK_NOW: process.env.ELECXSTOCK_NOW })
  if (process.env.ELECXSTOCK_NOW && offset != null) shiftClock(offset)

  const { dir, tried } = resolveDataDir({
    arg: o.data,
    env: process.env,
    platform: process.platform,
    home: homedir(),
    appData: process.env.APPDATA,
  })
  if (!existsSync(join(dir, 'market.db'))) {
    process.stderr.write(
      `elecxstock のデータが見つかりません。探した場所:\n${tried.map((t) => `  ${t}`).join('\n')}\nelecxstock を一度起動して初回の取り込みを済ませるか、--data で data フォルダを指定してください。\n`,
    )
    return 1
  }
  let reader: Reader
  try {
    reader = new Reader(dir)
  } catch (e) {
    if (e instanceof DbVersionError) process.stderr.write(`${e.message}\n`)
    else
      process.stderr.write(
        `データを開けませんでした（${dir}）: ${(e as Error).message}\nデータのフォルダに書けない場所（同期のフォルダの制限など）では開けないことがあります。\n`,
      )
    return 1
  }
  if (o.where) {
    const st = reader.status()
    process.stdout.write(
      `data: ${dir}\nDB の版: ${DB_VERSION}\n最終更新: ${st.lastUpdate ?? '—'}\n銘柄: ${st.instruments}\n対応する elecxstock: ${ELECXSTOCK_VERSION}\n`,
    )
    reader.close()
    return 0
  }
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    process.stderr.write('elecxstock-cli は端末（TTY）で動かしてください\n')
    reader.close()
    return 1
  }
  // 代替画面に切り替えて描く。どう終わっても（q・Ctrl+C・SIGTERM・落ちた）元の画面とカーソルに戻す
  const ESC = String.fromCharCode(27)
  process.stdout.write(`${ESC}[?1049h${ESC}[H${ESC}[?25l`)
  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    try {
      reader.close()
    } catch {}
    process.stdout.write(`${ESC}[?25h${ESC}[?1049l`)
  }
  const crash = (e: unknown) => {
    try {
      app.unmount()
    } catch {}
    restore()
    process.stderr.write(`elecxstock-cli が止まりました: ${(e as Error)?.stack ?? String(e)}\n`)
    process.exit(1)
  }
  process.on('exit', restore)
  process.on('uncaughtException', crash)
  process.on('unhandledRejection', crash)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.on(sig, () => {
      try {
        app.unmount()
      } catch {}
      restore()
      process.exit(0)
    })
  const app = render(React.createElement(App, { reader, initialTab: o.tab, theme: o.theme, color: o.color }), { exitOnCtrlC: false })
  app.waitUntilExit().then(restore, crash)
  return -1
}

const code = main()
if (code >= 0) process.exitCode = code
