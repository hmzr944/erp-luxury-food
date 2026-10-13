import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Les tests lisent les sources des paquets partagés, sans build préalable
      '@erp/utils': fileURLToPath(new URL('../../packages/utils/src/index.ts', import.meta.url)),
      '@erp/types': fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // Les specs Playwright (e2e/) tournent avec `pnpm test:e2e`, pas avec Vitest
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
