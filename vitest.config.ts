import { defineConfig } from 'vitest/config'

// Fast checks never install a project or start a Vite server. New test files
// outside these families remain in integration and always run in the full suite.
const unitFiles = ['test/{action-access,action-dispatch,client-bundle,conversation,conversation-context,current-state,capabilities,host,i18n,install-failure,memory-retry,package-manager,preferences,request,routes,session-resolution,status-access,start-tool,tool-result,blind-view,history,history-cache,record-validation,timing,windows-compat}.test.ts']

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: unitFiles } },
      { test: { name: 'integration', include: ['test/**/*.test.ts'], exclude: unitFiles } },
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Each comparison starts two real installs, builds and servers. Keep heavy
    // files separate so OS identity queries can run on shared two-core runners.
    fileParallelism: false,
    maxConcurrency: 2,
    // Tests create their own mocks. Automatic clearing can erase another
    // concurrent test's still-active boundary observation in Vitest 5.
    clearMocks: false,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/host/**/*.ts'],
      exclude: ['src/core/index.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
