import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// elecxstock のソース（vendor/elecxstock。v0.1.14 に固定したサブモジュール）を、アプリと同じ別名で読む
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))
export default defineConfig({
  resolve: { alias: { '@shared': r('vendor/elecxstock/src/shared'), '@core': r('vendor/elecxstock/src/core') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/support/setup.ts'],
    globalSetup: ['tests/support/seed.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
