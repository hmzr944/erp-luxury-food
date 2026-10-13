import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Les specs Playwright (e2e/) tournent avec `pnpm test:e2e`, pas avec Vitest
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
