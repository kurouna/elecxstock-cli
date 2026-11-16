// 手で動かすための架空のデータを .fixture/data に作る（npm run fixture）。npm run dev -- --data .fixture/data で見る
import { rmSync } from 'node:fs'
import { buildFixture } from '../tests/support/fixture'

rmSync('.fixture', { recursive: true, force: true })
await buildFixture('.fixture/data')
console.log('.fixture/data を作りました（値はすべて架空）')
