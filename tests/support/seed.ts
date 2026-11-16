// Vitest の globalSetup: 架空のデータの data フォルダ（種）を 1 回だけ作る。テストはその写しを読む（種は変えない）
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { buildFixture } from './fixture'

declare module 'vitest' {
  export interface ProvidedContext {
    seedDir: string
  }
}

export default async function setup(project: TestProject): Promise<() => void> {
  const root = mkdtempSync(join(tmpdir(), 'elecxstock-cli-seed-'))
  const dir = join(root, 'data')
  await buildFixture(dir)
  project.provide('seedDir', dir)
  return () => rmSync(root, { recursive: true, force: true })
}
