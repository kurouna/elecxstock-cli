// 1 本の ESM にまとめる（dist/elecxstock-cli.mjs）。elecxstock のソース（vendor/elecxstock）も一緒にまとめる。
// 同梱した OSS のライセンスを dist/THIRD_PARTY_NOTICES.txt に書き出す（GPL 系は入れない）
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const r = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
mkdirSync(r('dist'), { recursive: true })
// Ink の開発ツール（react-devtools-core）は使わないので空にする
writeFileSync(r('dist/devtools-stub.mjs'), 'export default { initialize() {}, connectToDevTools() {} }\n')
const result = await build({
  metafile: true,
  entryPoints: [r('src/main.ts')],
  outfile: r('dist/elecxstock-cli.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  alias: {
    '@shared': r('vendor/elecxstock/src/shared'),
    '@core': r('vendor/elecxstock/src/core'),
    'react-devtools-core': r('dist/devtools-stub.mjs'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  // CommonJS の依存が require する組み込みのモジュールのため
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(process.execPath);" },
  legalComments: 'eof',
  logLevel: 'warning',
})

// 同梱したパッケージ（metafile の入力のパスから node_modules/<名前> を取り出す）
const NL = '\n'
const pkgDir = /^(.*?node_modules\/(?:@[^/]+\/)?[^/]+)\//
const dirs = new Set()
for (const f of Object.keys(result.metafile.inputs)) {
  const m = f.replaceAll('\\', '/').match(pkgDir)
  if (m) dirs.add(r(m[1]))
}
const GPL = /\bA?GPL/i
const parts = [...dirs]
  .map((dir) => ({ dir, p: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .sort((a, b) => a.p.name.localeCompare(b.p.name))
  .map(({ dir, p }) => {
    const license = typeof p.license === 'string' ? p.license : (p.license?.type ?? 'UNKNOWN')
    if (GPL.test(license)) throw new Error(`GPL 系のライセンスは同梱しない: ${p.name} (${license})`)
    const file = readdirSync(dir).find((n) => /^(licen[cs]e|copying)(\.|$)/i.test(n))
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `${license}（パッケージにライセンスの文書がありません）`
    return `=== ${p.name}@${p.version} (${license}) ===${NL}${NL}${text}${NL}`
  })
const elecxstock = readFileSync(r('vendor/elecxstock/LICENSE'), 'utf8').trim()
writeFileSync(
  r('dist/THIRD_PARTY_NOTICES.txt'),
  [
    'Third-party software bundled in elecxstock-cli / elecxstock-cli に同梱しているソフトウェアのライセンス',
    '',
    'This executable contains the Node.js runtime (MIT and others: https://github.com/nodejs/node/blob/main/LICENSE).',
    'この実行ファイルには Node.js の実行環境が含まれます。',
    '',
    `=== elecxstock (MIT) ===${NL}${NL}${elecxstock}${NL}`,
    ...parts,
  ].join(NL),
)
console.log(`dist/elecxstock-cli.mjs（同梱した OSS ${dirs.size} 件のライセンスを dist/THIRD_PARTY_NOTICES.txt に）`)
