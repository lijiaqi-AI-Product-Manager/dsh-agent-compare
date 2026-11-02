import { describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner, type ComparerOptions } from '../src/core/orchestrator.ts'
import { BusyError, RunStore } from '../src/core/run-store.ts'
import * as gitModule from '../src/core/git.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

function latch() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve))
async function observed(promise: Promise<void>, name: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Did not observe ${name}`)), 60000) })]) }
  finally { if (timer) clearTimeout(timer) }
}
const edits: AgentRunner = {
  isolation: 'own-root',
  async run(request) {
    await writeFile(path.join(request.cwd, 'index.html'), `<h1>shop ${request.label}</h1>\n`)
    return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } }
  },
}
async function ready(prepareProjectProcess: ComparerOptions['prepareProjectProcess'] = prepareFixtureProcess) {
  const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-lifecycle'))
  const comparer = new Comparer({ store, runner: edits, version: 'test', prepareProjectProcess, browserChecks: false })
  const started = await comparer.start({ repo, task: 'update shop', assignment: 'fixed' })
  const record = (await comparer.wait(started.runId))!
  const stages = record.candidates.map(candidate => candidate.stage)
  if (stages.some(stage => stage !== 'ready')) await comparer.cleanup(record.runId)
  expect(stages, JSON.stringify(record)).toEqual(['ready', 'ready'])
  return { repo, store, comparer, record }
}

describe('comparison lifecycle', () => {
  it('closes admission immediately and waits for a start still awaiting repository discovery', async () => {
    const entered = latch(), gate = latch()
    const lookup = vi.spyOn(gitModule, 'repoRoot').mockImplementation(async () => { entered.release(); await gate.promise; return 'unused' })
    const comparer = new Comparer({ version: 'test', runner: edits, prepareProjectProcess: prepareFixtureProcess })
    const start = comparer.start({ repo: 'unused', task: 'start' })
    void start.catch(() => {})
    try {
      await observed(entered.promise, 'repository discovery')
      const disposal = comparer.dispose()
      expect(comparer.dispose()).toBe(disposal)
      let settled = false
      void disposal.then(() => { settled = true })
      await tick()
      expect(settled).toBe(false)
      await expect(comparer.start({ repo: 'unused', task: 'late' })).rejects.toBeInstanceOf(BusyError)
      expect(lookup).toHaveBeenCalledTimes(1)
      gate.release()
      await expect(start).rejects.toBeInstanceOf(BusyError)
      await disposal
    } finally { gate.release(); lookup.mockRestore(); await comparer.dispose() }
  })

  it('interrupts a start whose first save completes during shutdown without launching candidates', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-start-stop'))
    const entered = latch(), gate = latch(), original = store.save.bind(store)
    const save = vi.spyOn(store, 'save').mockImplementation(async record => {
      if (record.rev === 0) { entered.release(); await gate.promise }
      return original(record)
    })
    const run = vi.fn(edits.run)
    const comparer = new Comparer({ store, runner: { isolation: 'own-root', run }, version: 'test', prepareProjectProcess: prepareFixtureProcess })
    const start = comparer.start({ repo, task: 'start' })
    void start.catch(() => {})
    try {
      await observed(entered.promise, 'initial save')
      const disposal = comparer.dispose()
      gate.release()
      await expect(start).rejects.toBeInstanceOf(BusyError)
      await disposal
      const [record] = await store.list()
      expect(record?.state).toBe('interrupted')
      expect(record?.candidates.map(candidate => candidate.stage)).toEqual(['interrupted', 'interrupted'])
      expect(run).not.toHaveBeenCalled()
      expect(await gitModule.git(repo, ['for-each-ref', '--format=%(refname)', 'refs/agent-compare/'])).toBe('')
    } finally { gate.release(); save.mockRestore(); await comparer.dispose() }
  }, 120000)

  it('aborts a peer after a persistence failure but does not release its copy before the peer settles', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-peer-drain'))
    const peerStarted = latch(), peerAborted = latch(), peerExit = latch()
    let peerDone = false, persistenceFailed = false, interrupted = false
    const original = store.save.bind(store)
    const save = vi.spyOn(store, 'save').mockImplementation(async record => {
      if (!persistenceFailed && record.candidates.some(candidate => candidate.label === 'A' && candidate.stage === 'failed')) {
        persistenceFailed = true
        throw new Error('storage deliberately unavailable')
      }
      return original(record)
    })
    const runner: AgentRunner = {
      isolation: 'own-root',
      async run(request) {
        if (request.label === 'A') { await peerStarted.promise; throw new Error('candidate deliberately failed') }
        peerStarted.release()
        if (!request.signal.aborted) await new Promise<void>(resolve => request.signal.addEventListener('abort', () => resolve(), { once: true }))
        peerAborted.release()
        await peerExit.promise
        peerDone = true
        return { stopReason: 'aborted', usage: { kind: 'unknown', reason: 'fixture' } }
      },
    }
    const comparer = new Comparer({ store, runner, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false,
      onUpdate: record => { if (record.state === 'interrupted') interrupted = true },
    })
    const record = await comparer.start({ repo, task: 'start', assignment: 'fixed' })
    try {
      const done = comparer.wait(record.runId)
      let settled = false
      void done.then(() => { settled = true })
      await observed(peerAborted.promise, 'peer cancellation')
      expect(persistenceFailed).toBe(true)
      await tick()
      expect(settled).toBe(false)
      const cleanup = comparer.cleanup(record.runId)
      await tick()
      expect(existsSync(record.candidates[1]!.dir!)).toBe(true)
      expect(peerDone).toBe(false)
      peerExit.release()
      await done
      await cleanup
      expect(interrupted).toBe(true)
      expect(peerDone).toBe(true)
      expect(existsSync(record.candidates[1]!.dir!)).toBe(false)
    } finally { peerExit.release(); save.mockRestore(); await comparer.dispose() }
  }, 120000)

  it('saves stopped preview addresses and cancels a preview being reopened by the next host', async () => {
    const { store, comparer, record } = await ready()
    const previews = record.candidates.map(candidate => candidate.preview!)
    await comparer.dispose()
    expect((await store.load(record.runId))?.candidates.every(candidate => candidate.preview === undefined)).toBe(true)
    for (const preview of previews) await expect(fetch(preview.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
    const entered = latch(), gate = latch()
    const after = new Comparer({ store, runner: edits, version: 'test', prepareProjectProcess: async request => {
      entered.release()
      await gate.promise
      return prepareFixtureProcess(request)
    } })
    const opening = after.reopenPreview(record.runId, 'A')
    void opening.catch(() => {})
    try {
      await observed(entered.promise, 'preview preparation')
      const disposal = after.dispose()
      let settled = false
      void disposal.then(() => { settled = true })
      await tick()
      expect(settled).toBe(false)
      gate.release()
      await expect(opening).rejects.toThrow()
      await disposal
      expect((await store.load(record.runId))?.candidates.every(candidate => candidate.preview === undefined)).toBe(true)
    } finally {
      gate.release()
      await after.dispose()
      await new Comparer({ store, runner: edits, version: 'test', prepareProjectProcess: prepareFixtureProcess }).cleanup(record.runId)
    }
  }, 180000)

  it('drains a journaled adoption during shutdown and retains the selected files', async () => {
    const { repo, store, comparer, record } = await ready()
    await comparer.choose(record.runId, 'A')
    const entered = latch(), gate = latch(), original = store.save.bind(store)
    const save = vi.spyOn(store, 'save').mockImplementation(async current => {
      await original(current)
      if (current.adoption?.state === 'writing' && current.adoption.writtenPaths?.length === 0) { entered.release(); await gate.promise }
    })
    const adopting = comparer.adopt(record.runId)
    void adopting.catch(() => {})
    try {
      await observed(entered.promise, 'durable write journal')
      const disposal = comparer.dispose()
      let settled = false
      void disposal.then(() => { settled = true })
      await tick()
      expect(settled).toBe(false)
      gate.release()
      expect((await adopting).adoption?.state).toBe('adopted')
      await disposal
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop A</h1>\n')
      expect((await store.load(record.runId))?.state).toBe('adopted')
    } finally { gate.release(); save.mockRestore(); await comparer.dispose() }
  }, 180000)

  it('cancels rehearsal during shutdown before any target file is written', async () => {
    const entered = latch(), gate = latch()
    const { repo, store, comparer, record } = await ready(async request => {
      if (path.basename(request.cwd) === 'R') { entered.release(); await gate.promise }
      return prepareFixtureProcess(request)
    })
    await writeFile(path.join(repo, 'keep.txt'), 'user edits after generation\n')
    const head = await gitModule.git(repo, ['rev-parse', 'HEAD']), index = await gitModule.git(repo, ['ls-files', '-s'])
    await comparer.choose(record.runId, 'A')
    const adopting = comparer.adopt(record.runId)
    void adopting.catch(() => {})
    try {
      await observed(entered.promise, 'rehearsal installation')
      const disposal = comparer.dispose()
      gate.release()
      expect((await adopting).adoption?.state).toBe('blocked')
      await disposal
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('user edits after generation\n')
      expect(await gitModule.git(repo, ['rev-parse', 'HEAD'])).toBe(head)
      expect(await gitModule.git(repo, ['ls-files', '-s'])).toBe(index)
      expect((await store.load(record.runId))?.adoption?.writtenPaths).toBeUndefined()
    } finally {
      gate.release()
      await comparer.dispose()
      await new Comparer({ store, runner: edits, version: 'test', prepareProjectProcess: prepareFixtureProcess }).cleanup(record.runId)
    }
  }, 180000)
})
