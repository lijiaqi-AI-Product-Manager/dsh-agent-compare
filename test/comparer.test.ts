/**
 * End-to-end regressions for the orchestrator: real git, npm ci, build,
 * preview processes and adoption, with a scripted agent. Each test pins one
 * failure path that earlier versions got wrong.
 */
import { describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner, type AgentRunRequest, type ComparerOptions } from '../src/core/orchestrator.ts'
import { RunStore, StaleRecordError } from '../src/core/run-store.ts'
import { git, registeredWorktrees, withRepositoryWrite } from '../src/core/git.ts'
import { fetchPreview } from '../src/core/preview-url.ts'
import { commandHasMarkers, observeProcess, ownsProcess, type ProcessObservation } from '../src/core/proc.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

type Edit = (dir: string, req: AgentRunRequest) => Promise<void>

/** Plays both agents: A and B get their own edit function. `hang` agents never finish (after their edit, if any). */
function scripted(edits: { A?: Edit; B?: Edit }, opts: { hang?: 'A' | 'B'; editThenHang?: boolean; silent?: 'A' | 'B'; stopped?: 'A' | 'B' } = {}): AgentRunner {
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
      return { stopReason: opts.stopped === req.label ? 'aborted' : 'completed', summary: opts.silent === req.label ? '' : `scripted ${req.label}`, usage: { kind: 'reported', inputTokens: 10, outputTokens: 5, totalTokens: 15 } }
    },
  }
}
const defaultEdit: Edit = async (dir, req) => writeFile(path.join(dir, 'index.html'), `<h1>shop ${req.label}</h1>\n`)

async function setup(edits: { A?: Edit; B?: Edit }, opts: { hang?: 'A' | 'B'; editThenHang?: boolean; silent?: 'A' | 'B'; stopped?: 'A' | 'B'; task?: string; generationMs?: number; onUpdate?: ComparerOptions['onUpdate']; prepareProjectProcess?: ComparerOptions['prepareProjectProcess'] } = {}) {
  const repo = await fixtureRepo()
  const store = new RunStore(await tmp('ac-home'))
  const comparer = new Comparer({ prepareProjectProcess: opts.prepareProjectProcess ?? prepareFixtureProcess, store, runner: scripted(edits, opts), version: 'test', browserChecks: false, previewTimeoutMs: 120_000, ...(opts.generationMs ? { generationMs: opts.generationMs } : {}), ...(opts.onUpdate ? { onUpdate: opts.onUpdate } : {}) })
  const started = await comparer.start({ repo, task: opts.task ?? 'make the shop nicer', assignment: 'fixed' })
  const done = (await comparer.wait(started.runId))!
  const failedPreparation = done.candidates.filter(c => c.error?.stage === 'preparing')
  if (failedPreparation.length) {
    const details = failedPreparation.map(c => `${c.label}: ${c.error?.message ?? 'unknown preparation failure'}`).join('\n')
    try { await comparer.cleanup(started.runId) } catch { /* preserve the original preparation error below */ }
    throw new Error(`Comparison fixture preparation failed before the tested behavior:\n${details}`)
  }
  return { repo, store, comparer, runId: started.runId, done }
}

const T = 300_000

describe.concurrent('comparison run', () => {
  it('fails a redirected candidate without changing the target index, keeps the peer usable and retains ambiguous cleanup', async () => {
    let before: Buffer | undefined
    const { repo, store, comparer, runId, done } = await setup({ A: async (dir, req) => {
      const common = path.resolve(dir, (await git(dir, ['rev-parse', '--git-common-dir'])).trim())
      before = await readFile(path.join(common, 'index'))
      await defaultEdit(dir, req)
      const handle = await open(path.join(dir, '.git'), 'r+')
      try { await handle.truncate(0); await handle.writeFile(`gitdir: ${common}\n`) } finally { await handle.close() }
    } })
    let resumed: Comparer | undefined
    try {
      expect(done.candidates[0]).toMatchObject({ stage: 'failed', error: { stage: 'sealing', message: expect.stringContaining('pointer') } })
      expect(done.candidates[1]!.stage).toBe('ready')
      expect(await readFile(path.join(repo, '.git/index'))).toEqual(before)
      await comparer.dispose()
      resumed = new Comparer({ store: new RunStore(store.home), version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, runner: { isolation: 'own-root', run: async () => { throw new Error('No new generation during recovery') } } })
      await resumed.recover()
      await resumed.salvage(runId, 'A')
      expect((await resumed.wait(runId))!.candidates[0]).toMatchObject({ stage: 'failed', error: { stage: 'sealing', message: expect.stringContaining('pointer') } })
      await resumed.choose(runId, 'B')
      const adopted = await resumed.adopt(runId)
      expect(adopted.adoption?.state).toBe('adopted')
      expect(await readFile(path.join(repo, '.git/index'))).toEqual(before)
      expect(adopted.leftovers?.join(' ')).toContain('pointer')
      expect(await readFile(path.join(done.candidates[0]!.dir!, 'index.html'), 'utf8')).toContain('shop A')
    } finally { await resumed?.dispose(); await comparer.dispose() }
  }, T)

  it('continues the peer when one preparation fails and preserves an unowned directory', async () => {
    const repo = await fixtureRepo()
    const store = new RunStore(await tmp('ac-one-preparation-fails'))
    let foreign: string | undefined
    const comparer = new Comparer({ prepareProjectProcess: prepareFixtureProcess, store, runner: scripted({}), version: 'test', browserChecks: false, onUpdate: r => {
      const a = r.candidates[0]!
      if (!foreign && a.stage === 'preparing' && a.dir && a.ownerToken) {
        foreign = a.dir
        mkdirSync(a.dir, { recursive: true })
        writeFileSync(path.join(a.dir, 'foreign.txt'), 'keep this directory\n')
      }
    } })
    const started = await comparer.start({ repo, task: 'make the shop nicer', assignment: 'fixed' })
    try {
      const result = (await comparer.wait(started.runId))!
      expect(result.candidates[0]).toMatchObject({ stage: 'failed', error: { stage: 'preparing' } })
      expect(result.candidates[1]!.stage).toBe('ready')
    } finally { await comparer.cleanup(started.runId) }
    expect(foreign).toBeDefined()
    expect(await readFile(path.join(foreign!, 'foreign.txt'), 'utf8')).toBe('keep this directory\n')
  }, T)

  it('finishes both worktree preparations before either candidate starts generation', async () => {
    let observed = 0
    const edit: Edit = async (dir, req) => {
      for (const label of ['A', 'B']) expect(existsSync(path.join(path.dirname(dir), label, '.git'))).toBe(true)
      observed++
      await defaultEdit(dir, req)
    }
    const { comparer, runId, done } = await setup({ A: edit, B: edit })
    try {
      expect(observed).toBe(2)
      expect(done.candidates.every(c => c.stage === 'ready')).toBe(true)
    } finally { await comparer.cleanup(runId) }
  }, T)

  it('runs both candidates to an eligible, previewed build; copies live outside the repository', async () => {
    const commands: Array<{ cwd: string; argv: readonly string[] }> = []
    const { repo, comparer, runId, done } = await setup({}, { prepareProjectProcess: async request => {
      commands.push(request)
      return { ...await prepareFixtureProcess(request), enforcement: 'partial' }
    } })
    expect(done.state).toBe('judging')
    expect(done.isolation).toBe('own-root')
    for (const c of done.candidates) {
      expect(c.stage).toBe('ready')
      expect(c.verdict).toMatchObject({ eligible: true, reasons: [] })
      expect(c.preview?.kind).toBe('build')
      expect(c.install?.frozen).toBe(true)
      expect(c.checkedTree).toBe(c.candidateTree)
      expect(c.execution?.enforcement).toBe('partial')
      expect(c.verdict?.warnings.join()).toMatch(/部分文件写入约束/)
      const prepared = commands.filter(request => request.cwd === c.dir)
      expect(prepared.some(request => request.argv[0] === 'npm' && request.argv[1] === 'ci')).toBe(true)
      expect(prepared.some(request => request.argv[1] === 'run' && request.argv[2] === 'build')).toBe(true)
      expect(prepared.some(request => request.argv.includes('preview'))).toBe(true)
      expect(path.relative(repo, c.dir!).startsWith('..')).toBe(true)
      const html = await (await fetchPreview(c.preview!.url)).text()
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

  it('preserves completed installation and checks when the preview boundary fails', async () => {
    const { comparer, runId, done } = await setup({}, { prepareProjectProcess: async request => {
      if (request.argv.includes('preview')) throw new Error('preview deliberately unavailable')
      return { ...await prepareFixtureProcess(request), enforcement: 'partial' }
    } })
    try {
      for (const c of done.candidates) {
        expect(c.stage).toBe('failed')
        expect(c.error).toMatchObject({ stage: 'previewing', message: expect.stringContaining('preview deliberately unavailable') })
        expect(c.install).toMatchObject({ outcome: 'passed', frozen: true })
        expect(c.checks?.some(check => check.name === 'build' && check.outcome === 'passed')).toBe(true)
        expect(c.execution?.enforcement).toBe('partial')
      }
    } finally { await comparer.cleanup(runId) }
  }, T)

  it('a failing check makes the candidate ineligible for the working tree', async () => {
    const { repo, comparer, runId, done } = await setup({ A: async (dir) => writeFile(path.join(dir, 'index.html'), 'BROKEN\n') })
    expect(done.candidates[0]!.verdict?.reasons.join()).toMatch(/测试未通过/)
    await comparer.choose(runId, 'A')
    await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/没有通过共同验收/)
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    await comparer.cleanup(runId)
  }, T)

  it('refuses adoption when a broken candidate makes its verification helper always succeed', async () => {
    const { repo, comparer, runId, done } = await setup({ B: async (dir) => {
      await writeFile(path.join(dir, 'index.html'), 'BROKEN\n')
      await writeFile(path.join(dir, 'check.cjs'), "console.log('ok')\n")
    } })
    try {
      const candidate = done.candidates.find(c => c.label === 'B')!
      expect(candidate.checks?.find(c => c.name === 'test')?.outcome).toBe('passed')
      expect(candidate.acceptanceTouched).toContain('check.cjs')
      expect(candidate.verdict?.eligible).toBe(false)
      await comparer.choose(runId, 'B')
      await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/没有通过共同验收/)
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    } finally { await comparer.cleanup(runId) }
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
    expect(a.install?.failure?.kind).toBe('lockfile')
    expect(a.error?.message).toMatch(/锁文件与依赖定义不一致/)
    await expect(comparer.retryVerification(runId, 'A')).rejects.toThrow('锁文件不一致')
    expect(done.candidates[1]!.stage).toBe('ready')
    await comparer.cleanup(runId)
  }, T)

  it('a greeting inside a project that can be built is answered, not built', async () => {
    const prompts: string[] = []
    // A replies and changes nothing; B changes the page as before.
    const { repo, comparer, runId, done } = await setup({ A: async (_dir, req) => { prompts.push(req.prompt) } }, { task: '你好' })
    try {
      const [a, b] = done.candidates
      expect(done.task).toBe('你好')
      expect(prompts[0]).toContain('reply with the complete answer and change no files')
      expect(a).toMatchObject({ stage: 'ready', result: 'answer', summary: 'scripted A', checks: [], touchedFiles: [], generation: { ended: 'completed' } })
      // Nothing is installed, checked or served for a reply.
      expect(a!.install).toBeUndefined()
      expect(a!.preview).toBeUndefined()
      expect(a!.verdict).toMatchObject({ eligible: true, reasons: [] })
      expect(b!.stage).toBe('ready')
      expect(b!.result).toBeUndefined()
      expect(b!.preview).toBeDefined()
      await comparer.choose(runId, 'A')
      await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/只有回答/)
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    } finally { await comparer.cleanup(runId) }
  }, T)

  it('a candidate that changed nothing and said nothing still fails in a project', async () => {
    const { comparer, runId, done } = await setup({ A: async () => {} }, { silent: 'A' })
    try {
      expect(done.candidates[0]).toMatchObject({ stage: 'failed', error: { stage: 'sealing', message: expect.stringContaining('没有改动任何文件') } })
      expect(done.candidates[0]!.result).toBeUndefined()
      expect(done.candidates[1]!.stage).toBe('ready')
    } finally { await comparer.cleanup(runId) }
  }, T)

  it('an interrupted reply in a runnable project is not a completed answer', async () => {
    const { comparer, runId, done } = await setup({ A: async () => {} }, { stopped: 'A', task: '解释当前项目' })
    try {
      expect(done.candidates[0]).toMatchObject({ stage: 'failed', generation: { ended: 'agent-stopped' }, summary: 'scripted A', error: { stage: 'sealing' } })
      expect(done.candidates[0]!.result).toBeUndefined()
      expect(done.candidates[0]!.install).toBeUndefined()
      expect(done.candidates[1]!.stage).toBe('ready')
    } finally { await comparer.cleanup(runId) }
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
    const later = new Comparer({ prepareProjectProcess: prepareFixtureProcess, store, runner: scripted({}), version: 'test', browserChecks: false, previewTimeoutMs: 120_000 })
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
    const delegate = scripted({}, { hang: 'B' })
    let entered!: () => void, release!: () => void
    const generating = new Promise<void>(resolve => { entered = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const runner: AgentRunner = { isolation: 'own-root', async run(request) {
      if (request.label !== 'B') return delegate.run(request)
      entered()
      const result = await delegate.run(request)
      // Cancellation is requested, but this candidate has not acknowledged
      // its final exit. Keep "stopping" until that acknowledgement arrives.
      await gate
      return result
    } }
    const comparer = new Comparer({ prepareProjectProcess: prepareFixtureProcess, store, runner, version: 'test', browserChecks: false })
    const r = await comparer.start({ repo, task: 't', assignment: 'fixed' })
    try {
      await generating
      const stopping = await comparer.cancel(r.runId, 'B')
      expect(stopping?.candidates[1]!.stage).toBe('stopping')
      release()
      const done = (await comparer.wait(r.runId))!
      expect(done.candidates[1]!.stage).toBe('cancelled')
    } finally { release(); await comparer.cleanup(r.runId) }
  }, T)
})

describe.concurrent('adoption', () => {
  // Keep native Windows ownership queries separate from concurrent fixture builds.
  it('a preview stopped by a host restart can be opened again from its copy', { concurrent: process.platform !== 'win32', timeout: T }, async () => {
    const { store, comparer, runId, done } = await setup({})
    const previous = done.candidates[0]!.preview!
    await comparer.dispose()
    const prepare = vi.fn(prepareFixtureProcess)
    const after = new Comparer({ prepareProjectProcess: prepare, store, runner: scripted({}), version: 'test', browserChecks: false, previewTimeoutMs: 120_000 })
    let cleanupFinished = false
    try {
      await after.recover()
      const recovered = (await store.load(runId))!
      expect(recovered.candidates[0]!.preview).toBeUndefined()
      expect(await ownsProcess(previous.pid, [path.join(previous.cwd, 'node_modules', 'vite', 'bin', 'vite.js'), `--port ${previous.port}`])).toBe(false)
      await expect(fetchPreview(previous.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
      const reopened = await after.reopenPreview(runId, 'A')
      const p = reopened.candidates[0]!.preview!
      expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ cwd: reopened.candidates[0]!.dir, argv: expect.arrayContaining(['preview']) }))
      expect(p.kind).toBe('build')
      expect(await (await fetchPreview(p.url)).text()).toContain('shop A')
      const markers = [path.join(p.cwd, 'node_modules', 'vite', 'bin', 'vite.js'), `--port ${p.port}`]
      // System inspection can be unavailable briefly under load. A confirmed
      // mismatch or exit must fail immediately, with the observation preserved.
      const observations: ProcessObservation[] = []
      for (let attempt = 0; attempt < 3; attempt++) {
        const observation = await observeProcess(p.pid)
        observations.push(observation)
        if (observation.state !== 'unavailable') break
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200))
      }
      const observed = observations.at(-1)!
      const diagnostic = JSON.stringify({ pid: p.pid, markers, observations })
      expect(observed, diagnostic).toMatchObject({ state: 'observed' })
      if (observed.state === 'observed') expect(commandHasMarkers(observed.commandLine, markers), diagnostic).toBe(true)
      await after.cleanup(runId)
      cleanupFinished = true
      // Concurrent commands can reuse an exited PID. Check the preview's identity,
      // endpoint, retained record and owned copy after cleanup.
      expect(await ownsProcess(p.pid, markers)).toBe(false)
      await expect(fetchPreview(p.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
      const cleaned = (await store.load(runId))!
      expect(cleaned.candidates.every(candidate => candidate.preview === undefined)).toBe(true)
      expect(cleaned.leftovers).toBeUndefined()
      expect(existsSync(reopened.candidates[0]!.dir!)).toBe(false)
    } finally {
      if (!cleanupFinished) await after.cleanup(runId)
    }
  })

  it('writes exactly the checked tree, keeps index and HEAD, then releases copies and previews', async () => {
    const { repo, store, comparer, runId, done } = await setup({})
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const staged = await git(repo, ['ls-files', '-s'])
    const previews = done.candidates.map((c) => c.preview!)
    await comparer.choose(runId, 'A')
    const r = await comparer.adopt(runId, 'worktree')
    expect(r.state).toBe('adopted')
    expect(r.adoption).toMatchObject({ state: 'adopted', rehearsal: { reused: true } })
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop A</h1>\n')
    expect((await git(repo, ['rev-parse', 'HEAD'])).trim()).toBe(head)
    expect(await git(repo, ['ls-files', '-s'])).toBe(staged)
    for (const c of r.candidates) expect(existsSync(c.dir!)).toBe(false)
    for (const p of previews) {
      // A PID can be reused by another concurrent command; verify identity and
      // the actual application endpoint instead of treating that PID as ours.
      expect(await ownsProcess(p.pid, [path.join(p.cwd, 'node_modules', 'vite', 'bin', 'vite.js'), `--port ${p.port}`])).toBe(false)
      await expect(fetchPreview(p.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
    }
    // The saved record no longer points at the stopped previews, so history shows screenshots, not a dead frame.
    const saved = (await new RunStore(store.home).load(runId))!
    for (const c of saved.candidates) expect(c.preview).toBeUndefined()
    // Revert restores the pre-adopt content.
    const reverted = await comparer.revert(runId)
    expect(reverted.adoption?.state).toBe('reverted')
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
  }, T)

  it('keeps a completed adoption when cleanup fails and retries cleanup separately', async () => {
    const { repo, store, comparer, runId } = await setup({})
    await comparer.choose(runId, 'A')
    const cleanup = vi.spyOn(comparer as unknown as { releaseResources(r: unknown): Promise<void> }, 'releaseResources').mockRejectedValueOnce(new Error('resource is busy'))
    try {
      const result = await comparer.adopt(runId, 'worktree')
      expect(result.state).toBe('adopted')
      expect(result.adoption?.state).toBe('adopted')
      expect(result.leftovers?.join()).toContain('resource is busy')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop A</h1>\n')
      expect((await store.load(runId))?.adoption?.state).toBe('adopted')
    } finally { cleanup.mockRestore(); await comparer.cleanup(runId) }
    expect((await store.load(runId))?.leftovers).toBeUndefined()
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
    const { repo, comparer, runId, done } = await setup({})
    try {
      const candidate = done.candidates.find((c) => c.label === 'B')!
      expect(candidate.stage, JSON.stringify(candidate.error)).toBe('ready')
      await writeFile(path.join(repo, 'keep.txt'), 'keep\nmine\n')
      await comparer.choose(runId, 'B')
      const r = await comparer.adopt(runId, 'worktree')
      expect(r.adoption).toMatchObject({ state: 'adopted', rehearsal: { reused: false } })
      expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nmine\n')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop B</h1>\n')
    } finally {
      await comparer.cleanup(runId)
      await comparer.dispose()
    }
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

  it.each(['rehearsal', 'journal'] as const)('preserves edits made during adoption %s', async (boundary) => {
    let targetRepo: string | undefined
    let edited = false
    const mine = '<h1>edited while adopting</h1>\n'
    const { repo, store, comparer, runId } = await setup({}, {
      onUpdate: (record) => {
        const reached = boundary === 'rehearsal' ? record.adoption?.rehearsal?.reused === false : record.adoption?.state === 'writing'
        if (targetRepo !== undefined && reached && !edited) {
          edited = true
          writeFileSync(path.join(targetRepo, 'index.html'), mine)
        }
      },
    })
    targetRepo = repo
    try {
      // A non-overlapping edit forces the combined result through rehearsal.
      await writeFile(path.join(repo, 'keep.txt'), 'keep\nchanged before adoption\n')
      const head = await git(repo, ['rev-parse', 'HEAD'])
      const staged = await git(repo, ['ls-files', '-s', '-z'])
      await comparer.choose(runId, 'A')
      const result = await comparer.adopt(runId)
      expect(edited).toBe(true)
      expect(result.state).toBe('revealed')
      expect(result.adoption?.state).toBe('blocked')
      expect(result.adoption?.attention).toContain('index.html')
      expect(result.adoption?.message).toMatch(/尚未写入任何文件/)
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe(mine)
      expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nchanged before adoption\n')
      expect(await git(repo, ['rev-parse', 'HEAD'])).toBe(head)
      expect(await git(repo, ['ls-files', '-s', '-z'])).toBe(staged)
      expect((await store.load(runId))?.adoption?.state).toBe('blocked')
      expect(result.adoption?.writtenPaths ?? []).toEqual([])
      // Resolve the overlap, then retry using the existing verified candidate.
      await writeFile(path.join(repo, 'index.html'), '<h1>shop</h1>\n')
      const retried = await comparer.adopt(runId)
      expect(retried.adoption?.state).toBe('adopted')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop A</h1>\n')
      await comparer.revert(runId)
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nchanged before adoption\n')
    } finally {
      await comparer.cleanup(runId)
      await comparer.dispose()
    }
  }, T)

  it('rolls back only attempted paths when a later file changes to the candidate content', async () => {
    let targetRepo: string | undefined
    let edited = false
    const mine = 'independently saved content\n'
    const { repo, store, comparer, runId } = await setup({
      A: async (dir) => {
        await writeFile(path.join(dir, 'index.html'), '<h1>shop A</h1>\n')
        await writeFile(path.join(dir, 'keep.txt'), mine)
      },
    }, {
      onUpdate: (record) => {
        if (targetRepo !== undefined && record.adoption?.state === 'writing' && record.adoption.writtenPaths?.length === 2 && !edited) {
          edited = true
          writeFileSync(path.join(targetRepo, 'keep.txt'), mine)
        }
      },
    })
    targetRepo = repo
    try {
      const head = await git(repo, ['rev-parse', 'HEAD'])
      const staged = await git(repo, ['ls-files', '-s', '-z'])
      await comparer.choose(runId, 'A')
      const result = await comparer.adopt(runId)
      expect(edited).toBe(true)
      expect(result.state).toBe('revealed')
      expect(result.adoption?.state).toBe('rolled-back')
      expect(result.adoption?.writtenPaths).toEqual(['index.html'])
      expect(result.adoption?.attention).toContain('keep.txt')
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe(mine)
      expect(await git(repo, ['rev-parse', 'HEAD'])).toBe(head)
      expect(await git(repo, ['ls-files', '-s', '-z'])).toBe(staged)
      expect((await store.load(runId))?.adoption?.writtenPaths).toEqual(['index.html'])
    } finally {
      await comparer.cleanup(runId)
      await comparer.dispose()
    }
  }, T)

  it('an adoption interrupted mid-write becomes recovery and can be restored', async () => {
    const { repo, store, comparer, runId } = await setup({})
    await comparer.choose(runId, 'A')
    await comparer.adopt(runId, 'worktree')
    // Simulate a host stop between the journal and the end of the write.
    await comparer.dispose()
    const r = (await store.load(runId))!
    r.state = 'adopting'
    r.adoption!.state = 'writing'
    await store.save(r)
    const after = new Comparer({ prepareProjectProcess: prepareFixtureProcess, store, runner: scripted({}), version: 'test' })
    expect(await after.recover()).toContain(runId)
    expect((await store.load(runId))!.state).toBe('recovery')
    await expect(after.revert(runId)).rejects.toThrow(/只有写入工作区或保存到文件夹的采用可以撤销/)
    const restored = await after.recoverAdoption(runId, 'restore')
    expect(restored.state).toBe('revealed')
    expect(restored.adoption?.state).toBe('rolled-back')
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
  }, T)

  it('a second adoption on the same repository is refused while one holds the repository lock', async () => {
    const { repo, store, comparer, runId } = await setup({})
    await comparer.choose(runId, 'A')
    const res = await withRepositoryWrite(repo, () => comparer.adopt(runId, 'worktree').then(() => 'adopted', (e: Error) => e.message))
    expect(res).toMatch(/正在进行另一项采用/)
    expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    await comparer.cleanup(runId)
  }, T)
})

describe.concurrent('resource ownership', () => {
  it('cleanup deletes only copies it can prove it created', async () => {
    const { store, comparer, runId } = await setup({})
    // This case verifies directory ownership. Process observation failures
    // are exercised separately; stop the known live handles first.
    await comparer.dispose()
    const fake = await tmp('ac-not-ours')
    await mkdir(path.join(fake, 'keep'), { recursive: true })
    await writeFile(path.join(fake, 'keep', 'file.txt'), 'precious')
    const r = (await store.load(runId))!
    for (const candidate of r.candidates) delete candidate.preview
    r.candidates[0]!.dir = fake
    await store.save(r)
    const cleaned = (await new Comparer({ prepareProjectProcess: prepareFixtureProcess, store, runner: scripted({}), version: 'test' }).cleanup(runId))!
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
    // Stopping a preview must not overwrite a revision saved by another writer.
    await expect(comparer.dispose()).rejects.toMatchObject({ errors: [expect.any(StaleRecordError)] })
    expect(await store.load(runId)).toEqual(a)
    const reclaimed = await new RunStore(store.home).acquireLock(`owner-${runId}`)
    reclaimed.release()
  }, T)
})
