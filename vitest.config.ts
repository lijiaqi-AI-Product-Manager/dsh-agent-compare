import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Comparer tests each run two real installs, builds and servers; keep the load bounded.
    maxConcurrency: 3,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/host/**/*.ts'],
      exclude: ['src/core/index.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
