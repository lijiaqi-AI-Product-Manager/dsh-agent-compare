import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Comparer tests each run two real installs, builds and servers; keep the load bounded.
    maxConcurrency: 3,
  },
})
