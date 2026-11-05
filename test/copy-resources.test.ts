import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer } from '../src/core/orchestrator.ts'
import { planCopyCleanup } from '../src/core/copy-resources.ts'
import { git, ownedWorktreeAdmin } from '../src/core/git.ts'
import { RunStore } from '../src/core/run-store.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

describe('explicit comparison copy release', () => {
  it('keeps blind scale private, refuses changed or unowned copies and preserves later adoption and undo', async () => {
    const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-space'))
    const comparer = new Comparer({ store, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, runner: { isolation: 'own-root', async run(request) {
      await writeFile(path.join(request.cwd, 'index.html'), `<h1>Version ${request.label}</h1>\n`)
      return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } }
    } } })
    const started = await comparer.start({ repo, task: 'Compare two headings', assignment: 'fixed' })
    try {
      const done = (await comparer.wait(started.runId))!
      expect(done.candidates.every(candidate => candidate.verdict?.eligible)).toBe(true)
      const blind = await comparer.copyCleanupPlan(done.runId)
      expect(blind).toMatchObject({ allowed: false, bytes: 0, resources: [] })
      expect(blind.reasons.join()).toContain('盲选')
      await comparer.choose(done.runId, 'B')
      const a = done.candidates[0]!, b = done.candidates[1]!
      const original = await readFile(path.join(a.dir!, 'index.html'))
      const plan = await comparer.copyCleanupPlan(done.runId)
      expect(plan.allowed).toBe(true)
      expect(plan.resources).toHaveLength(2)
      expect(plan.bytes).toBeGreaterThan(0)
      const selected = (await store.load(done.runId))!
      expect(selected.candidates[1]!.preview).toBeDefined()
      const withoutDir = structuredClone(selected)
      delete withoutDir.candidates[1]!.dir
      const missingDirPlan = await planCopyCleanup(withoutDir)
      expect(missingDirPlan.allowed).toBe(false)
      expect(missingDirPlan.reasons.join()).toContain('预览缺少对应副本目录')
      const wrongPreview = structuredClone(selected)
      wrongPreview.candidates[1]!.preview = { ...wrongPreview.candidates[1]!.preview!, cwd: a.dir! }
      expect((await planCopyCleanup(wrongPreview)).reasons.join()).toContain('预览目录与副本不一致')
      const deletedCopy = structuredClone(selected)
      deletedCopy.candidates[1]!.dir = path.join(b.dir!, 'absent')
      deletedCopy.candidates[1]!.preview = { ...deletedCopy.candidates[1]!.preview!, cwd: deletedCopy.candidates[1]!.dir! }
      expect((await planCopyCleanup(deletedCopy)).reasons.join()).toContain('副本目录不存在')
      expect(existsSync(b.dir!)).toBe(true)
      await writeFile(path.join(a.dir!, 'index.html'), '<h1>Later edit</h1>')
      await expect(comparer.releaseCopies(done.runId, plan.token)).rejects.toThrow(/后续修改/)
      expect(existsSync(b.dir!)).toBe(true)
      await writeFile(path.join(a.dir!, 'index.html'), original)
      const admin = await ownedWorktreeAdmin(repo, b.dir!, { runId: done.runId, label: 'B', token: b.ownerToken! })
      const markFile = path.join(admin, 'agent-compare-owner.json'), mark = await readFile(markFile)
      await writeFile(markFile, '{}')
      expect((await comparer.copyCleanupPlan(done.runId)).allowed).toBe(false)
      expect(existsSync(b.dir!)).toBe(true)
      await writeFile(markFile, mark)
      const beforeCache = await comparer.copyCleanupPlan(done.runId)
      await mkdir(path.join(a.dir!, '.vite'), { recursive: true })
      await writeFile(path.join(a.dir!, '.vite', 'later-cache'), 'changed')
      await expect(comparer.releaseCopies(done.runId, beforeCache.token)).rejects.toThrow(/发生变化/)
      expect(existsSync(a.dir!)).toBe(true)
      await rm(path.join(a.dir!, '.vite', 'later-cache'))
      const current = await comparer.copyCleanupPlan(done.runId)
      const refs = await git(repo, ['for-each-ref', `refs/agent-compare/${done.runId}/`])
      const patches = await Promise.all(done.candidates.map(candidate => readFile(candidate.patchFile!)))
      const released = await comparer.releaseCopies(done.runId, current.token)
      expect(released).toMatchObject({ state: 'revealed', copiesReleasedAt: expect.any(Number) })
      expect(released.leftovers).toBeUndefined()
      expect(done.candidates.every(candidate => !existsSync(candidate.dir!))).toBe(true)
      expect(await git(repo, ['for-each-ref', `refs/agent-compare/${done.runId}/`])).toBe(refs)
      expect(await Promise.all(done.candidates.map(candidate => readFile(candidate.patchFile!)))).toEqual(patches)
      expect(await store.load(done.runId)).toMatchObject({ copiesReleasedAt: released.copiesReleasedAt })
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      const adopted = await comparer.adopt(done.runId, 'worktree')
      expect(adopted.adoption?.state).toBe('adopted')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toContain('Version B')
      expect((await comparer.revert(done.runId)).adoption?.state).toBe('reverted')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect((await comparer.copyCleanupPlan(done.runId)).reasons.join()).toContain('没有可释放')
    } finally { await comparer.dispose() }
  }, 240_000)

  it('blocks active, unknown-exit and recovery states before inspecting directories', async () => {
    const record = { coordination: 'invalid', state: 'running', candidates: [{ stage: 'generating', stopUnconfirmed: true }], adoption: { state: 'needs-recovery', rehearsal: { stopUnconfirmed: true } }, runId: '12345678', rev: 3 } as any
    const plan = await planCopyCleanup(record)
    expect(plan).toMatchObject({ allowed: false, resources: [], bytes: 0 })
    expect(plan.reasons.join()).toMatch(/尚未结束/)
    expect(plan.reasons.join()).toMatch(/未确认退出/)
    expect(plan.reasons.join()).toMatch(/恢复仍需要处理/)
  })
})
