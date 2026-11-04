import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, publicView, type AgentRunner } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import * as processes from '../src/core/project-process.ts'
import { fetchPreview } from '../src/core/preview-url.ts'
import { ProcessStopError } from '../src/core/proc.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

afterEach(() => vi.restoreAllMocks())
const T = 180_000

async function setup(editA?: (dir: string) => Promise<void>) {
  const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-verification-retry'))
  const actual = processes.runProjectProcess
  let attempts = 0, stall: 'installing' | 'verifying' | undefined, entered!: () => void
  const waiting = new Promise<void>(resolve => { entered = resolve })
  const command = vi.spyOn(processes, 'runProjectProcess').mockImplementation(async (argv, options, prepare) => {
    if (argv.includes('ci') && path.basename(options.cwd) === 'A') {
      attempts++
      if (attempts === 1) return { code: 1, stdout: '', stderr: 'npm error code ECONNRESET\nnpm error network connection reset', timedOut: false, aborted: false, truncated: false }
    }
    if (path.basename(options.cwd) === 'A' && ((stall === 'installing' && argv.includes('ci')) || (stall === 'verifying' && argv[1] === 'run' && argv[2] === 'test'))) {
        entered()
        await new Promise<void>(resolve => {
          if (options.signal?.aborted) resolve()
          else options.signal?.addEventListener('abort', () => resolve(), { once: true })
        })
        return { code: null, stdout: '', stderr: '', timedOut: false, aborted: true, truncated: false }
    }
    return actual(argv, options, prepare)
  })
  const generate = vi.fn(async (request: Parameters<AgentRunner['run']>[0]) => {
    await writeFile(path.join(request.cwd, 'index.html'), `<h1>result ${request.label}</h1>\n`)
    if (request.label === 'A') await editA?.(request.cwd)
    return { stopReason: 'completed', usage: { kind: 'unknown' as const, reason: 'not reported' } }
  })
  const comparer = new Comparer({ store, runner: { isolation: 'own-root', run: generate }, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false })
  const started = await comparer.start({ repo, task: 'improve the fixture', assignment: 'fixed' })
  const done = (await comparer.wait(started.runId))!
  expect(done.candidates[0]).toMatchObject({ stage: 'failed', install: { frozen: true, failure: { kind: 'network', code: 'ECONNRESET' } } })
  expect(done.candidates[1]!.stage).toBe('ready')
  return { repo, store, comparer, runId: started.runId, done, generate, command, runActual: actual, attempts: () => attempts, stall: (stage: 'installing' | 'verifying') => { stall = stage }, resume: () => { stall = undefined }, waiting }
}

describe('explicit retries of sealed verification', () => {
  it('retains a rehearsal with an uncertain stop and refuses to overwrite its ownership on another adoption', async () => {
    const f = await setup()
    try {
      f.command.mockImplementation(async (argv, options, prepare) => {
        if (path.basename(options.cwd) === 'R' && argv.includes('ci')) throw new ProcessStopError(12345)
        return f.runActual(argv, options, prepare)
      })
      await f.comparer.choose(f.runId, 'B')
      await writeFile(path.join(f.repo, 'notes.txt'), 'user notes after comparison\n')
      const result = await f.comparer.adopt(f.runId)
      expect(result.adoption).toMatchObject({ state: 'blocked', rehearsal: { stopUnconfirmed: true } })
      const rehearsal = result.adoption!.rehearsal!
      expect(await readFile(path.join(rehearsal.dir!, 'index.html'), 'utf8')).toContain('result B')
      await expect(f.comparer.adopt(f.runId)).rejects.toThrow('先前预演的进程停止状态未知')
      const cleaned = (await f.comparer.cleanup(f.runId))!
      expect(cleaned.adoption!.rehearsal!.ownerToken).toBe(rehearsal.ownerToken)
      expect(cleaned.leftovers!.join()).toContain(rehearsal.dir)
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect(await readFile(path.join(f.repo, 'notes.txt'), 'utf8')).toBe('user notes after comparison\n')
    } finally {
      f.command.mockRestore()
      await f.comparer.dispose()
      // No process was created by this injected failure; release only the fixture.
      const saved = (await f.store.load(f.runId))!
      if (saved.adoption?.rehearsal) delete saved.adoption.rehearsal.stopUnconfirmed
      await f.store.save(saved)
      const cleanup = new Comparer({ store: f.store, version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('must not generate') } } })
      try { await cleanup.cleanup(f.runId) } finally { await cleanup.dispose() }
    }
  }, T)

  it('retains an uncertain process copy across cleanup and restart instead of admitting another retry', async () => {
    const f = await setup()
    const dir = f.done.candidates[0]!.dir!
    try {
      f.command.mockImplementation(async (argv, options, prepare) => {
        if (argv.includes('ci') && path.basename(options.cwd) === 'A') throw new ProcessStopError(12345)
        return f.runActual(argv, options, prepare)
      })
      await f.comparer.retryVerification(f.runId, 'A')
      const done = (await f.comparer.wait(f.runId))!
      expect(done.candidates[0]).toMatchObject({ stage: 'failed', stopUnconfirmed: true, error: { stage: 'installing' } })
      expect(publicView(done).candidates[0]!.canRetryVerification).toBe(false)
      await expect(f.comparer.retryVerification(f.runId, 'A')).rejects.toThrow('现在不能重新验收')
      const cleaned = (await f.comparer.cleanup(f.runId))!
      expect(cleaned.leftovers!.join()).toContain(dir)
      expect(await readFile(path.join(dir, 'index.html'), 'utf8')).toContain('result A')
      await f.comparer.dispose()
      const next = new Comparer({ store: f.store, version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('must not generate') } } })
      try {
        await next.recover()
        const retained = (await next.cleanup(f.runId))!
        expect(retained.candidates[0]!.stopUnconfirmed).toBe(true)
        expect(retained.leftovers!.join()).toContain(dir)
        expect(await readFile(path.join(dir, 'index.html'), 'utf8')).toContain('result A')
      } finally { await next.dispose() }
    } finally {
      f.command.mockRestore()
      await f.comparer.dispose()
      // The stop error above was injected without creating a process.
      const saved = (await f.store.load(f.runId))!
      delete saved.candidates[0]!.stopUnconfirmed
      await f.store.save(saved)
      const cleanup = new Comparer({ store: f.store, version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('must not generate') } } })
      try { await cleanup.cleanup(f.runId) } finally { await cleanup.dispose() }
    }
  }, T)

  it('retries frozen installation and all checks without regeneration, preserves evidence and adopts the same bytes', async () => {
    const f = await setup()
    try {
      const a = f.done.candidates[0]!, before = { commit: a.candidateCommit, tree: a.candidateTree, patch: a.patchSha256, acceptance: f.done.acceptance.sha256 }
      const bUrl = f.done.candidates[1]!.preview!.url
      expect(publicView(f.done).candidates[0]!.canRetryVerification).toBe(true)
      const admitted = await f.comparer.retryVerification(f.runId, 'A')
      expect(admitted.state).toBe('running')
      expect(admitted.candidates[0]!.verificationHistory).toHaveLength(1)
      expect(admitted.candidates[0]!.verificationHistory![0]!.install!.failure!.kind).toBe('network')
      expect(admitted.candidates[0]!.checks).toBeUndefined()
      expect(admitted.candidates[0]!.verdict).toBeUndefined()
      expect(admitted.candidates[0]!.checkedTree).toBeUndefined()
      const done = (await f.comparer.wait(f.runId))!, retried = done.candidates[0]!
      expect(done.state).toBe('judging')
      expect(retried).toMatchObject({ stage: 'ready', install: { frozen: true, outcome: 'passed' }, verdict: { eligible: true }, usage: { kind: 'unknown' } })
      expect(retried.install!.runtime).toMatchObject({ hostNode: process.version, platform: process.platform, packageManager: 'npm' })
      expect(retried.install!.runtime!.packageManagerVersion).toMatch(/^\d+\.\d+\.\d+/)
      expect(retried.candidateCommit).toBe(before.commit)
      expect(retried.candidateTree).toBe(before.tree)
      expect(retried.patchSha256).toBe(before.patch)
      expect(done.acceptance.sha256).toBe(before.acceptance)
      expect(done.candidates[1]!.preview!.url).toBe(bUrl)
      expect((await fetchPreview(bUrl)).status).toBe(200)
      expect(f.generate).toHaveBeenCalledTimes(2)
      expect(f.attempts()).toBe(2)
      const installations = f.command.mock.calls.filter(([argv]) => argv[0] === 'npm' && ['ci', 'install'].includes(argv[1]!))
      expect(installations).toHaveLength(3)
      expect(installations.every(([argv]) => argv[1] === 'ci')).toBe(true)
      expect((await f.store.load(f.runId))!.candidates[0]!.verificationHistory).toHaveLength(1)
      await f.comparer.choose(f.runId, 'A')
      await expect(f.comparer.retryVerification(f.runId, 'A')).rejects.toThrow('现在不能重新验收')
      expect((await f.comparer.adopt(f.runId)).adoption!.state).toBe('adopted')
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>result A</h1>\n')
      await f.comparer.revert(f.runId)
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    } finally { await f.comparer.cleanup(f.runId); await f.comparer.dispose() }
  }, T)

  it('keeps the old result and retry budget intact when admission cannot be saved', async () => {
    const f = await setup(), actualSave = f.store.save.bind(f.store)
    try {
      const before = (await f.store.load(f.runId))!
      const saving = vi.spyOn(f.store, 'save').mockImplementation(async record => {
        if (record.state === 'running' && record.candidates[0]!.verificationHistory?.length) throw new Error('retry journal unavailable')
        return actualSave(record)
      })
      await expect(f.comparer.retryVerification(f.runId, 'A')).rejects.toThrow('retry journal unavailable')
      saving.mockRestore()
      expect((await f.store.load(f.runId))!.rev).toBe(before.rev)
      const current = (await f.comparer.get(f.runId))!
      expect(current.state).toBe('judging')
      expect(current.candidates[0]!.verificationHistory).toBeUndefined()
      expect(current.candidates[0]!.install!.failure!.kind).toBe('network')
      expect(f.attempts()).toBe(1)
      await f.comparer.retryVerification(f.runId, 'A')
      expect((await f.comparer.wait(f.runId))!.candidates[0]!.stage).toBe('ready')
    } finally { await f.comparer.cleanup(f.runId); await f.comparer.dispose() }
  }, T)

  it.each(['copy', 'patch'] as const)('refuses a changed %s before retrying any command', async boundary => {
    const f = await setup()
    try {
      const candidate = f.done.candidates[0]!
      const file = boundary === 'copy' ? path.join(candidate.dir!, 'index.html') : candidate.patchFile!
      await writeFile(file, 'later editing that must remain\n')
      await expect(f.comparer.retryVerification(f.runId, 'A')).rejects.toThrow(boundary === 'copy' ? '副本已变化' : '补丁与记录不一致')
      expect(await readFile(file, 'utf8')).toBe('later editing that must remain\n')
      expect(f.attempts()).toBe(1)
      expect(f.generate).toHaveBeenCalledTimes(2)
    } finally { await f.comparer.cleanup(f.runId); await f.comparer.dispose() }
  }, T)

  it.each(['installing', 'verifying'] as const)('admits only one retry, cancels during %s and keeps the peer interactive', async stage => {
    const f = await setup()
    f.stall(stage)
    try {
      const results = await Promise.allSettled([f.comparer.retryVerification(f.runId, 'A'), f.comparer.retryVerification(f.runId, 'A')])
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
      await f.waiting
      await expect(f.comparer.start({ repo: f.repo, task: 'another task' })).rejects.toThrow('已有')
      await f.comparer.cancel(f.runId, 'A')
      const stopped = (await f.comparer.wait(f.runId))!
      expect(stopped.candidates[0]!.stage).toBe('cancelled')
      expect(stopped.candidates[0]!.error!.stage).toBe(stage)
      expect(stopped.candidates[0]!.install!.outcome).toBe(stage === 'installing' ? 'cancelled' : 'passed')
      expect(stopped.candidates[1]!.stage).toBe('ready')
      expect((await fetchPreview(stopped.candidates[1]!.preview!.url)).status).toBe(200)
      expect(publicView(stopped).candidates[0]!.canRetryVerification).toBe(true)
      f.resume()
      await f.comparer.retryVerification(f.runId, 'A')
      const done = (await f.comparer.wait(f.runId))!
      expect(done.candidates[0]!.stage).toBe('ready')
      expect(done.candidates[0]!.verificationHistory).toHaveLength(2)
      expect(f.generate).toHaveBeenCalledTimes(2)
    } finally { await f.comparer.cleanup(f.runId); await f.comparer.dispose() }
  }, T)

  it('retries after a host restart with the same sealed candidate and retained failure', async () => {
    const f = await setup()
    await f.comparer.dispose()
    const next = new Comparer({ store: new RunStore(f.store.home), version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('Retry must not generate') } }, prepareProjectProcess: prepareFixtureProcess, browserChecks: false })
    try {
      await next.recover()
      const before = (await next.get(f.runId))!.candidates[0]!.candidateCommit
      await next.retryVerification(f.runId, 'A')
      const done = (await next.wait(f.runId))!
      expect(done.candidates[0]!).toMatchObject({ stage: 'ready', candidateCommit: before, verdict: { eligible: true } })
      expect(done.candidates[0]!.verificationHistory![0]!.install!.failure!.kind).toBe('network')
      expect(f.generate).toHaveBeenCalledTimes(2)
    } finally { await next.cleanup(f.runId); await next.dispose() }
  }, T)

  it('never relaxes the original acceptance when a candidate altered protected checks', async () => {
    const f = await setup(async dir => writeFile(path.join(dir, 'check.cjs'), 'console.log("changed check")\n'))
    try {
      await f.comparer.retryVerification(f.runId, 'A')
      const done = (await f.comparer.wait(f.runId))!
      expect(done.candidates[0]!.stage).toBe('ready')
      expect(done.candidates[0]!.verdict!.eligible).toBe(false)
      expect(done.candidates[0]!.acceptanceTouched).toContain('check.cjs')
      await f.comparer.choose(f.runId, 'A')
      await expect(f.comparer.adopt(f.runId)).rejects.toThrow()
    } finally { await f.comparer.cleanup(f.runId); await f.comparer.dispose() }
  }, T)
})
