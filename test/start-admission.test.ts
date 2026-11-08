import { describe, expect, it, vi } from 'vitest'
import { Comparer, type AgentRunner } from '../src/core/orchestrator.ts'
import { BusyError, RunStore, StaleRecordError } from '../src/core/run-store.ts'
import * as storeModule from '../src/core/run-store.ts'
import * as gitModule from '../src/core/git.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

const runner = (): AgentRunner => ({ isolation: 'own-root', run: vi.fn(async () => { throw new Error('candidate must not start') }) })

describe('comparison start admission', () => {
  it('rejects an invalid capacity before accepting work', () => {
    for (const maxActiveRuns of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => new Comparer({ version: 'test', runner: runner(), maxActiveRuns })).toThrow(/maxActiveRuns/)
    }
  })

  it('reserves capacity before the first repository lookup settles and releases a failed reservation', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const lookup = vi.spyOn(gitModule, 'repoRoot').mockImplementation(async () => {
      if (lookup.mock.calls.length === 1) await gate
      throw new Error('repository deliberately unavailable')
    })
    const comparer = new Comparer({ version: 'test', runner: runner(), prepareProjectProcess: prepareFixtureProcess })
    // An existing directory whose Git lookup fails for a reason other than "not a repository".
    const repo = await tmp('ac-admission')
    const first = comparer.start({ repo, task: 'first' })
    void first.catch(() => {})
    try {
      try {
        await expect(comparer.start({ repo, task: 'second' })).rejects.toBeInstanceOf(BusyError)
        expect(lookup).toHaveBeenCalledTimes(1)
      } finally { release(); await first.catch(() => {}) }
      await expect(comparer.start({ repo, task: 'retry' })).rejects.toThrow('repository deliberately unavailable')
      expect(lookup).toHaveBeenCalledTimes(2)
    } finally { lookup.mockRestore(); await comparer.dispose() }
  })

  it('frees a failed initial save without pinning a baseline or retaining a live placeholder', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-failed-start'))
    const head = await gitModule.git(repo, ['rev-parse', 'HEAD']), index = await gitModule.git(repo, ['ls-files', '-s'])
    const ids: string[] = []
    const save = vi.spyOn(store, 'save').mockImplementation(async record => { ids.push(record.runId); throw new Error(`save ${ids.length} deliberately failed`) })
    const agent = runner(), comparer = new Comparer({ store, runner: agent, version: 'test', prepareProjectProcess: prepareFixtureProcess })
    try {
      await expect(comparer.start({ repo, task: 'first' })).rejects.toThrow('save 1 deliberately failed')
      expect(await comparer.get(ids[0]!)).toBeUndefined()
      await expect(comparer.start({ repo, task: 'retry' })).rejects.toThrow('save 2 deliberately failed')
      expect(ids).toHaveLength(2)
      expect(agent.run).not.toHaveBeenCalled()
      expect(await gitModule.git(repo, ['for-each-ref', '--format=%(refname)', 'refs/agent-compare/'])).toBe('')
      expect(await gitModule.git(repo, ['rev-parse', 'HEAD'])).toBe(head)
      expect(await gitModule.git(repo, ['ls-files', '-s'])).toBe(index)
    } finally { save.mockRestore(); await comparer.dispose() }
  }, 120000)

  it('transfers a reservation without counting it twice while the first record save is pending', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-transfer-start'))
    let entered!: () => void, release!: () => void
    const saving = new Promise<void>(resolve => { entered = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const save = vi.spyOn(store, 'save').mockImplementation(async record => {
      if (record.task === 'first') { entered(); await gate }
      throw new Error(`${record.task} save deliberately stopped`)
    })
    const agent = runner(), comparer = new Comparer({ store, runner: agent, version: 'test', maxActiveRuns: 2, prepareProjectProcess: prepareFixtureProcess })
    const first = comparer.start({ repo, task: 'first' })
    void first.catch(() => {})
    try {
      await saving
      await expect(comparer.start({ repo, task: 'second' })).rejects.toThrow('second save deliberately stopped')
      expect(agent.run).not.toHaveBeenCalled()
    } finally { release(); await first.catch(() => {}); save.mockRestore(); await comparer.dispose() }
  }, 120000)

  it('retains the original live entry when a new identifier collides during startup', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-colliding-start'))
    let entered!: () => void, release!: () => void
    const saving = new Promise<void>(resolve => { entered = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const id = vi.spyOn(storeModule, 'newRunId').mockReturnValue('0a1b2c3d')
    const save = vi.spyOn(store, 'save').mockImplementation(async () => { entered(); await gate; throw new Error('first save deliberately stopped') })
    const agent = runner(), comparer = new Comparer({ store, runner: agent, version: 'test', maxActiveRuns: 2, prepareProjectProcess: prepareFixtureProcess })
    const first = comparer.start({ repo, task: 'first' })
    void first.catch(() => {})
    try {
      await saving
      await expect(comparer.start({ repo, task: 'second' })).rejects.toBeInstanceOf(StaleRecordError)
      expect((await comparer.get('0a1b2c3d'))?.task).toBe('first')
      expect(save).toHaveBeenCalledTimes(1)
      expect(agent.run).not.toHaveBeenCalled()
    } finally { release(); await first.catch(() => {}); save.mockRestore(); id.mockRestore(); await comparer.dispose() }
  }, 120000)

  it('marks an accepted record interrupted if its baseline cannot be pinned', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-pin-start'))
    const pin = vi.spyOn(gitModule, 'pinRef').mockRejectedValue(new Error('baseline deliberately unavailable'))
    const agent = runner(), comparer = new Comparer({ store, runner: agent, version: 'test', prepareProjectProcess: prepareFixtureProcess })
    try {
      await expect(comparer.start({ repo, task: 'first' })).rejects.toThrow('baseline deliberately unavailable')
      const [record] = await store.list()
      expect(record?.state).toBe('interrupted')
      expect(record?.rev).toBe(2)
      expect(record?.candidates.every(candidate => candidate.stage === 'interrupted')).toBe(true)
      expect(agent.run).not.toHaveBeenCalled()
      await expect(comparer.start({ repo, task: 'retry' })).rejects.toThrow('baseline deliberately unavailable')
    } finally { pin.mockRestore(); await comparer.dispose() }
  }, 120000)
})
