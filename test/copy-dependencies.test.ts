import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer } from '../src/core/orchestrator.ts'
import { planCopyCleanup } from '../src/core/copy-resources.ts'
import { RunStore } from '../src/core/run-store.ts'
import { milestoneOf, memoryNote } from '../src/host/conversation.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

async function fillDependencies(dir: string, files: number): Promise<void> {
  const nested = path.join(dir, 'node_modules', 'large-package', 'lib')
  await mkdir(nested, { recursive: true })
  await Promise.all(Array.from({ length: files }, (_, i) => writeFile(path.join(nested, `file-${i}.js`), `module.exports = ${i}\n`)))
}

describe('dependency-heavy copies and revised picks', () => {
  it('releases copies whose dependency trees exceed the scan budget and keeps the token independent of sizing', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-deps'))
    const comparer = new Comparer({ store, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, runner: { isolation: 'own-root', async run(request) {
      await writeFile(path.join(request.cwd, 'index.html'), `<h1>Version ${request.label}</h1>\n`)
      return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } }
    } } })
    const started = await comparer.start({ repo, task: 'Compare two headings', assignment: 'fixed' })
    try {
      const done = (await comparer.wait(started.runId))!
      await comparer.choose(done.runId, 'A')
      for (const candidate of done.candidates) await fillDependencies(candidate.dir!, 60)
      const record = (await store.load(done.runId))!

      // Source entries stay bounded; dependency contents never count against that bound.
      const tight = await planCopyCleanup(record, undefined, { entries: 40, dependencyEntries: 10 })
      expect(tight.allowed).toBe(true)
      expect(tight.resources.every(resource => resource.estimated)).toBe(true)
      const complete = await planCopyCleanup(record, undefined, { entries: 40 })
      expect(complete.allowed).toBe(true)
      expect(complete.resources.some(resource => resource.estimated)).toBe(false)
      expect(complete.bytes).toBeGreaterThan(tight.bytes)
      const unmeasured = await planCopyCleanup(record, undefined, { measureDependencies: false })
      expect(new Set([tight.token, complete.token, unmeasured.token]).size).toBe(1)

      // A new top-level dependency directory changes what is deleted, so it invalidates the token.
      await mkdir(path.join(done.candidates[0]!.dir!, '.vite'), { recursive: true })
      await expect(comparer.releaseCopies(done.runId, complete.token)).rejects.toThrow(/发生变化/)
      const current = await comparer.copyCleanupPlan(done.runId)
      const released = await comparer.releaseCopies(done.runId, current.token)
      expect(released.copiesReleasedAt).toEqual(expect.any(Number))
      expect(done.candidates.every(candidate => !existsSync(candidate.dir!))).toBe(true)
    } finally { await comparer.dispose() }
  }, 240_000)

  it('lets the user change the pick after the reveal until an adoption exists, keeping the blind pick', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-repick'))
    const comparer = new Comparer({ store, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, runner: { isolation: 'own-root', async run(request) {
      await writeFile(path.join(request.cwd, 'index.html'), `<h1>Version ${request.label}</h1>\n`)
      return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } }
    } } })
    const started = await comparer.start({ repo, task: 'Compare two headings', assignment: 'fixed' })
    try {
      const done = (await comparer.wait(started.runId))!
      const blind = await comparer.choose(done.runId, 'B')
      const blindMilestone = milestoneOf(blind)
      expect(blindMilestone).toBe('choice:B')
      await expect(comparer.choose(done.runId, 'B')).rejects.toThrow(/已经选了/)
      await expect(comparer.choose(done.runId, 'none')).rejects.toThrow(/只能改选/)
      const revised = await comparer.choose(done.runId, 'A')
      expect(revised.choice).toMatchObject({ pick: 'A', initialPick: 'B' })
      expect(revised.revealedAt).toBe(blind.revealedAt)
      expect(milestoneOf(revised)).not.toBe(blindMilestone)
      expect(memoryNote(revised)).toContain('blind pick: B')
      expect((await store.load(done.runId))!.choice).toMatchObject({ pick: 'A', initialPick: 'B' })
      const again = await comparer.choose(done.runId, 'B')
      expect(again.choice).toMatchObject({ pick: 'B', initialPick: 'B' })
      await comparer.adopt(done.runId, 'branch')
      await expect(comparer.choose(done.runId, 'A')).rejects.toThrow()
    } finally { await comparer.dispose() }
  }, 240_000)
})
