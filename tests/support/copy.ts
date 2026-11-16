// 種の data フォルダの写し（テストごとに作る。種は変えない）
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inject } from 'vitest'

export function copySeed(): { dir: string; dispose: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'elecxstock-cli-test-'))
  const dir = join(root, 'data')
  cpSync(inject('seedDir'), dir, { recursive: true })
  return {
    dir,
    dispose: () => {
      try {
        rmSync(root, { recursive: true, force: true })
      } catch {
        /* Windows では閉じた直後に消せないことがある */
      }
    },
  }
}
