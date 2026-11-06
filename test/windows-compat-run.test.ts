import { describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner } from '../src/core/orchestrator.ts'
import type { PrepareProjectProcess } from '../src/core/project-process.ts'
import { RunStore } from '../src/core/run-store.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

describe('frozen process compatibility', () => {
  it('retains the admitted mode across verification, host restart, preview and adoption rehearsal', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-frozen-process-mode'))
    const modes: Array<string | undefined> = []
    const prepare: PrepareProjectProcess = async request => { modes.push(request.windowsProcessCompat); return prepareFixtureProcess(request) }
    const runner: AgentRunner = { isolation: 'own-root', run: async request => {
      await writeFile(path.join(request.cwd, 'index.html'), `<h1>candidate ${request.label}</h1>\n`)
      return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'offline fixture' } }
    } }
    const options = { store, runner, prepareProjectProcess: prepare, version: 'test', browserChecks: false, previewTimeoutMs: 120_000 }
    const first = new Comparer(options)
    let resumed: Comparer | undefined, runId: string | undefined
    try {
      const started = await first.start({ repo, task: 'change heading', windowsProcessCompat: 'off', assignment: 'fixed' })
      runId = started.runId
      const done = (await first.wait(runId))!
      expect(done.candidates.map(candidate => candidate.stage)).toEqual(['ready', 'ready'])
      expect(done.acceptance.runtime.windowsProcessCompat).toBe('off')
      // The offline fixture does not pretend to report real host diagnostics.
      expect(done.candidates[0]!.install?.runtime?.windowsProcessCompat).toEqual({ mode: 'unknown', observedHooks: [] })
      await first.dispose()
      resumed = new Comparer(options)
      await resumed.recover()
      await resumed.reopenPreview(runId, 'A')
      await resumed.choose(runId, 'A')
      expect((await resumed.adopt(runId)).adoption?.state).toBe('adopted')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toContain('candidate A')
      expect(modes.length).toBeGreaterThan(10)
      expect(new Set(modes)).toEqual(new Set(['off']))
      expect((await store.load(runId))!.acceptance.runtime.windowsProcessCompat).toBe('off')
    } finally {
      if (runId) await (resumed ?? first).cleanup(runId)
      await resumed?.dispose()
      await first.dispose()
    }
  }, 300_000)
})
