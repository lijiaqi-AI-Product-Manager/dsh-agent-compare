/**
 * End-to-end regressions for the orchestrator: real git, npm ci, build,
 * preview processes and adoption, with a scripted agent. Each test pins one
 * failure path that earlier versions got wrong.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner, type AgentRunRequest } from '../src/core/orchestrator.ts'
import { RunStore, repoKey, StaleRecordError } from '../src/core/run-store.ts'
import { git, registeredWorktrees } from '../src/core/git.ts'
import { isAlive } from '../src/core/proc.ts'
import { fixtureRepo, tmp } from './fixture.ts'

type Edit = (dir: string, req: AgentRunRequest) => Promise<void>

/** Plays both agents: A and B get their own edit function. `hang` agents never finish (after their edit, if any). */
function scripted(edits: { A?: Edit; B?: Edit }, opts: { hang?: 'A' | 'B'; editThenHang?: boolean } = {}): AgentRunner {
  return {
    isolation: 'own-root',
    async run(req) {
      if (opts.hang === req.label) {
        if (opts.editThenHang) await (edits[req.label] ?? defaultEdit)(req.cwd, req)
        await new Promise<void>((resolve) => {
          if (req.signal.aborted) return resolve()
          req.signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return { stopReason: 'aborted', usage: { kind: 'unknown', reason: 'scripted' } }
      }
      await (edits[req.label] ?? defaultEdit)(req.cwd, req)
      return { stopReason: 'completed', summary: `scripted ${req.label}`, usage: { kind: 'reported', inputTokens: 10, outputTokens: 5, totalTokens: 15 } }
    },
  }
}
const defaultEdit: Edit = async (dir, req) => writeFile(path.join(dir, 'index.html'), `<h1>shop ${req.label}</h1>\n`)

async function setup(edits: { A?: Edit; B?: Edit }, opts: { hang?: 'A' | 'B'; editThenHang?: boolean; generationMs?: number } = {}) {
  const repo = await fixtureRepo()
  const store = new RunStore(await tmp('ac-home'))
  const comparer = new Comparer({ store, runner: scripted(edits, opts), version: 'test', browserChecks: false, previewTimeoutMs: 120_000, ...(opts.generationMs ? { generationMs: opts.generationMs } : {}) })
  const started = await comparer.start({ repo, task: 'make the shop nicer', assignment: 'fixed' })
  const done = (await comparer.wait(started.runId))!
  return { repo, store, comparer, runId: started.runId, done }
}

const T = 300_000

describe.concurrent('comparison run', () => {
  it('runs both candidates to an eligible, previewed build; copies live outside the repository', async () => {
    const { repo, comparer, runId, done } = await setup({})
    expect(done.state).toBe('judging')
    expect(done.isolation).toBe('own-root')
    for (const c of done.candidates) {
      expect(c.stage).toBe('ready')
      expect(c.verdict).toMatchObject({ eligible: true, reasons: [] })
      expect(c.preview?.kind).toBe('build')
      expect(c.install?.frozen).toBe(true)
      expect(c.checkedTree).toBe(c.candidateTree)
      expect(path.relative(repo, c.dir!).startsWith('..')).toBe(true)
      const html = await (await fetch(c.preview!.url)).text()
      expect(html).toContain(`shop ${c.label}`)
    }
    expect(done.candidates[0]!.usage).toMatchObject({ kind: 'reported', totalTokens: 15 })
    await comparer.cleanup(runId)
  }, T)

  it('a candidate that rewrites the test script passes the check but is not eligible', async () => {
    const { comparer, runId, done } = await setup({
      B: async (dir) => {
        await writeFile(path.join(dir, 'index.html'), 'BROKEN\n')
        const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
        pkg.scripts.test = 'node -e "process.exit(0)"'
        await writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
      },
    })
    const b = done.candidates.find((c) => c.label === 'B')!
    expect(b.checks?.find((k) => k.name === 'test')?.outcome).toBe('passed')
    expect(b.acceptanceTouched).toContain('package.json scripts.test')
    expect(b.verdict?.eligible).toBe(false)
    await comparer.choose(runId, 'B')
    await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/没有通过共同验收/)
    // Inspection is still possible without touching the checkout.
    const branched = await comparer.adopt(runId, 'branch')
    expect(branched.adoption?.branch).toBe(`agent-compare/${runId}-B`)
    await comparer.cleanup(runId)
  }, T)

  it('a failing check makes the candidate ineligible for the working tree', async () => {
    const { repo, comparer, runId, done } = await setup({ A: async (dir) => writeFile(path.join(dir, 'index.html'), 'BROKEN\n') })
    expect(done.candidates[0]!.verdict?.reasons.join()).toMatch(/测试未通过/)
    await comparer.choose(runId, 'A')
    await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/没有通过共同验收/)
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    await comparer.cleanup(runId)
  }, T)

  it('changing dependencies without the lockfile fails at a frozen install, with no unlocked retry', async () => {
    const { comparer, runId, done } = await setup({
      A: async (dir) => {
        const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
        pkg.devDependencies['left-pad-stub'] = 'file:vendor/vite'
        await writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
      },
    })
    const a = done.candidates[0]!
    expect(a.stage).toBe('failed')
    expect(a.error?.stage).toBe('installing')
    expect(a.error?.message).toMatch(/冻结安装失败/)
    expect(done.candidates[1]!.stage).toBe('ready')
    await comparer.cleanup(runId)
  }, T)

  it('a generation over budget with nothing written fails that candidate only', async () => {
    const { comparer, runId, done } = await setup({}, { hang: 'A', generationMs: 1500 })
    expect(done.candidates[0]!.stage).toBe('failed')
    expect(done.candidates[0]!.generation).toEqual({ ended: 'budget' })
    expect(done.candidates[0]!.error?.message).toMatch(/超出生成时间预算.*还没有改动任何文件/)
    expect(done.candidates[1]!.stage).toBe('ready')
    await comparer.cleanup(runId)
  }, T)

  it('work written before the budget ran out is sealed and verified, not discarded', async () => {
    const { comparer, runId, done } = await setup({}, { hang: 'A', editThenHang: true, generationMs: 1500 })
    const a = done.candidates[0]!
    expect(a.stage).toBe('ready')
    expect(a.generation).toEqual({ ended: 'budget' })
    expect(a.verdict?.eligible).toBe(true)
    expect(a.verdict?.warnings.join()).toMatch(/时间预算截断/)
    await comparer.cleanup(runId)
  }, T)

  it('a candidate an earlier version failed at the budget can be salvaged and verified', async () => {
    const { store, comparer, runId } = await setup({})
    await comparer.dispose()
    // The record as the previous behaviour left it: B failed while generating, its copy intact.
    const r = (await store.load(runId))!
    const b = r.candidates[1]!
    for (const k of ['generation', 'patchFile', 'patchSha256', 'patchStats', 'touchedFiles', 'candidateCommit', 'candidateTree', 'acceptanceTouched', 'dependencyChange', 'install', 'checks', 'checkedTree', 'drift', 'preview', 'screenshot', 'mobileScreenshot', 'verdict'] as const) delete b[k]
    b.stage = 'failed'
    b.stopReason = 'aborted'
    b.error = { stage: 'generating', message: '超出生成时间预算（30 分钟），已停止这个候选' }
    b.timings = { preparing: b.timings.preparing!, generating: b.timings.generating! }
    await store.save(r)
    const later = new Comparer({ store, runner: scripted({}), version: 'test', browserChecks: false, previewTimeoutMs: 120_000 })
    const started = await later.salvage(runId, 'B')
    expect(started.candidates[1]!.stage).toBe('sealing')
    const done = (await later.wait(runId))!
    expect(done.candidates[1]).toMatchObject({ stage: 'ready', generation: { ended: 'budget' }, verdict: { eligible: true } })
    expect(done.checksFavoured).toBe('tie')
    await expect(later.salvage(runId, 'B')).rejects.toThrow(/只有在生成阶段中止/)
    await later.choose(runId, 'B')
    expect((await later.adopt(runId, 'worktree')).adoption?.state).toBe('adopted')
  }, T)

  it('cancel shows stopping, then settles as cancelled', async () => {
    const repo = await fixtureRepo()
    const store = new RunStore(await tmp('ac-home'))
    const comparer = new Comparer({ store, runner: scripted({}, { hang: 'B' }), version: 'test', browserChecks: false })
    const r = await comparer.start({ repo, task: 't', assignment: 'fixed' })
    await new Promise((res) => setTimeout(res, 1500))
    const stopping = await comparer.cancel(r.runId, 'B')
    expect(stopping?.candidates[1]!.stage).toBe('stopping')
    const done = (await comparer.wait(r.runId))!
    expect(done.candidates[1]!.stage).toBe('cancelled')
    await comparer.cleanup(r.runId)
  }, T)
})

describe.concurrent('adoption', () => {
  it('a preview stopped by a host restart can be opened again from its copy', async () => {
    const { store, comparer, runId, done } = await setup({})
    await comparer.dispose()
    const after = new Comparer({ store, runner: scripted({}), version: 'test', browserChecks: false, previewTimeoutMs: 120_000 })
    await after.recover()
    const recovered = (await store.load(runId))!
    expect(recovered.candidates[0]!.preview).toBeUndefined()
    expect(isAlive(done.candidates[0]!.preview!.pid)).toBe(false)
    const reopened = await after.reopenPreview(runId, 'A')
    const p = reopened.candidates[0]!.preview!
    expect(p.kind).toBe('build')
    expect(await (await fetch(p.url)).text()).toContain('shop A')
    await after.cleanup(runId)
    expect(isAlive(p.pid)).toBe(false)
  }, T)

  it('writes exactly the checked tree, keeps index and HEAD, then releases copies and previews', async () => {
    const { repo, store, comparer, runId, done } = await setup({})
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const staged = await git(repo, ['ls-files', '-s'])
    const pids = done.candidates.map((c) => c.preview!.pid)
    await comparer.choose(runId, 'A')
    const r = await comparer.adopt(runId, 'worktree')
    expect(r.state).toBe('adopted')
    expect(r.adoption).toMatchObject({ state: 'adopted', rehearsal: { reused: true } })
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop A</h1>\n')
    expect((await git(repo, ['rev-parse', 'HEAD'])).trim()).toBe(head)
    expect(await git(repo, ['ls-files', '-s'])).toBe(staged)
    for (const c of r.candidates) expect(existsSync(c.dir!)).toBe(false)
    for (const pid of pids) expect(isAlive(pid)).toBe(false)
    // The saved record no longer points at the stopped previews, so history shows screenshots, not a dead frame.
    const saved = (await new RunStore(store.home).load(runId))!
    for (const c of saved.candidates) expect(c.preview).toBeUndefined()
    // Revert restores the pre-adopt content.
    const reverted = await comparer.revert(runId)
    expect(reverted.adoption?.state).toBe('reverted')
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
  }, T)

  it('rehearses on the current checkout and blocks, writing nothing, when the combination fails', async () => {
    const { repo, comparer, runId } = await setup({ A: async (dir) => writeFile(path.join(dir, 'index.html'), '<h1>NEW</h1>\n') })
    await writeFile(path.join(repo, 'flag.txt'), 'the user added this after the baseline\n')
    await comparer.choose(runId, 'A')
    const r = await comparer.adopt(runId, 'worktree')
    expect(r.state).toBe('revealed')
    expect(r.adoption?.state).toBe('blocked')
    expect(r.adoption?.rehearsal?.reused).toBe(false)
    expect(r.adoption?.message).toMatch(/尚未写入任何文件/)
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    expect(await registeredWorktrees(repo)).toHaveLength(3) // main + A + B; the rehearsal copy is gone
    await comparer.cleanup(runId)
  }, T)

  it('rehearses and adopts when the user changed other files, keeping those changes', async () => {
    const { repo, comparer, runId } = await setup({})
    await writeFile(path.join(repo, 'keep.txt'), 'keep\nmine\n')
    await comparer.choose(runId, 'B')
    const r = await comparer.adopt(runId, 'worktree')
    expect(r.adoption).toMatchObject({ state: 'adopted', rehearsal: { reused: false } })
    expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nmine\n')
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop B</h1>\n')
  }, T)

  it('blocks on overlap with a later user edit', async () => {
    const { repo, comparer, runId } = await setup({})
    await writeFile(path.join(repo, 'index.html'), '<h1>mine</h1>\n')
    await comparer.choose(runId, 'A')
    const r = await comparer.adopt(runId, 'worktree')
    expect(r.adoption).toMatchObject({ state: 'blocked', attention: ['index.html'] })
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>mine</h1>\n')
    await comparer.cleanup(runId)
  }, T)

  it('an adoption interrupted mid-write becomes recovery and can be restored', async () => {
    const { repo, store, comparer, runId } = await setup({})
    await comparer.choose(runId, 'A')
    await comparer.adopt(runId, 'worktree')
    // Simulate a host stop between the journal and the end of the write.
    const r = (await store.load(runId))!
    r.state = 'adopting'
    r.adoption!.state = 'writing'
    await store.save(r)
    const after = new Comparer({ store, runner: scripted({}), version: 'test' })
    expect(await after.recover()).toContain(runId)
    expect((await store.load(runId))!.state).toBe('recovery')
    await expect(after.revert(runId)).rejects.toThrow(/只有写入工作区的采用可以撤销/)
    const restored = await after.recoverAdoption(runId, 'restore')
    expect(restored.state).toBe('revealed')
    expect(restored.adoption?.state).toBe('rolled-back')
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
  }, T)

  it('a second adoption on the same repository is refused while one holds the repository lock', async () => {
    const { repo, store, comparer, runId } = await setup({})
    await comparer.choose(runId, 'A')
    const res = await store.withLock(`repo-${repoKey(repo)}`, () => comparer.adopt(runId, 'worktree').then(() => 'adopted', (e: Error) => e.message))
    expect(res).toMatch(/正在进行另一项采用/)
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    await comparer.cleanup(runId)
  }, T)
})

describe.concurrent('resource ownership', () => {
  it('cleanup deletes only copies it can prove it created', async () => {
    const { store, comparer, runId } = await setup({})
    const fake = await tmp('ac-not-ours')
    await mkdir(path.join(fake, 'keep'), { recursive: true })
    await writeFile(path.join(fake, 'keep', 'file.txt'), 'precious')
    const r = (await store.load(runId))!
    r.candidates[0]!.dir = fake
    await store.save(r)
    const cleaned = (await new Comparer({ store, runner: scripted({}), version: 'test' }).cleanup(runId))!
    expect(existsSync(path.join(fake, 'keep', 'file.txt'))).toBe(true)
    expect(cleaned.leftovers?.[0]).toContain(fake)
    expect(existsSync(cleaned.candidates[1]!.dir!)).toBe(false)
    await comparer.dispose()
  }, T)

  it('refuses a save from a stale copy of the record', async () => {
    const { store, comparer, runId } = await setup({})
    const a = (await store.load(runId))!
    const b = (await store.load(runId))!
    await store.save(a)
    await expect(store.save(b)).rejects.toBeInstanceOf(StaleRecordError)
    await comparer.dispose()
  }, T)
})
