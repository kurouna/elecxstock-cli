// README 用の画面の例（文字だけ）を docs/screens/*.txt に書き出す（npm run frames）。
// 架空のデータ（.fixture/data。無ければ npm run fixture で作る）と基準日時で描く。値はすべて架空
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { shiftClock, TEST_NOW } from '@shared/clock'
import { K, start } from '../tests/support/app'

if (!existsSync('.fixture/data/market.db')) throw new Error('先に npm run fixture で架空のデータを作ってください')
shiftClock(Date.parse(TEST_NOW) - Date.now())
mkdirSync('docs/screens', { recursive: true })
const W = 120
const H = 34
const scenes: [string, number, string[], string][] = [
  ['watchlist', 3, [], 'お気に入り'],
  ['detail', 3, [K.down, K.down, K.down, K.enter], '› 8306'],
  ['holdings', 4, [], '合計'],
  ['folio', 5, [], '資産推移'],
  ['market', 1, [], '騰落'],
]
for (const [name, tab, keys, wait] of scenes) {
  const app = await start({ width: W, height: H, tab, dir: '.fixture/data' })
  await app.press(...keys)
  await app.until(wait)
  // 色の符号を外し、行末の空白を落とす
  const ESC = String.fromCharCode(27)
  const text = app
    .frame()
    .replace(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
  writeFileSync(`docs/screens/${name}.txt`, `${text.trimEnd()}\n`)
  app.stop()
  console.log(`docs/screens/${name}.txt`)
}
process.exit(0)
