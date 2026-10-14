import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Chaque test ouvre de vrais sockets locaux : pas de parallélisme entre fichiers
    fileParallelism: false,
    testTimeout: 15000,
  },
})
