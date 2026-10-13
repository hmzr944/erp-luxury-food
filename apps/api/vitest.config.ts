import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  // Les tests lisent les sources des paquets partagés, sans build préalable
  resolve: { alias: { '@erp/types': pkg('types'), '@erp/utils': pkg('utils') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts', 'src/main.ts'],
    },
  },
})
