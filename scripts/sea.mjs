// Node.js の単一実行ファイル（SEA）にする: dist/elecxstock-cli(.exe)。この Node の実行ファイルに dist/elecxstock-cli.mjs を埋め込む
import { execFileSync } from 'node:child_process'
import { rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// node --build-sea と mainFormat: module は Node 25.5 から
const [maj, min] = process.versions.node.split('.').map(Number)
if (maj < 25 || (maj === 25 && min < 5)) throw new Error(`単一実行ファイルを作るには Node 25.5 以降が要ります（今は ${process.version}）`)
const r = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const out = r(`dist/elecxstock-cli${process.platform === 'win32' ? '.exe' : ''}`)
rmSync(out, { force: true })
const config = r('dist/sea-config.json')
writeFileSync(
  config,
  JSON.stringify(
    { main: r('dist/elecxstock-cli.mjs'), mainFormat: 'module', output: out, disableExperimentalSEAWarning: true, useCodeCache: false },
    null,
    1,
  ),
)
execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' })
console.log(`${out} (${Math.round(statSync(out).size / 1048576)} MB)`)
