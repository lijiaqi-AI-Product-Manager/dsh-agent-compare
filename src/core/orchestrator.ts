import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rmdir } from 'node:fs/promises'
import { addOwnedWorktree, ALWAYS_EXCLUDED, captureChange, changedPaths, commitTree, dropRefs, ensureWorktreePool, git, headCommit, pinRef, readPatchSha, removeOwnedWorktree, repoRoot, snapshotTree, treeOf, writePatch } from './git.ts'
import { adoptAsBranch, AdoptError, CandidateWriteError, checkWritten, pinPreAdopt, preflight, targetChanges, undoAdoption, writeCandidate, type NameStatus } from './adopt.ts'
import { checksScore, runBrowserCheck, runCommandChecks } from './checks.ts'
import { acceptanceChanges, buildAcceptance, inspectProject, installArgv } from './project.ts'
import { startVitePreview, PreviewError, type Preview } from './preview.ts'
import { commandHasMarkers, killTree, observeProcess, run, waitGone } from './proc.ts'
import { BusyError, newRunId, repoKey, RunStore } from './run-store.ts'
import { BALANCED, candidatePrompt, DEFAULT_STRATEGIES } from './strategies.ts'
import { RUN_SCHEMA, type Acceptance, type AgentRoute, type Candidate, type CandidateLabel, type CandidateStage, type CheckResult, type ChecksSpec, type PreviewInfo, type RunRecord, type Strategy, type Usage, type Verdict } from './types.ts'

export interface AgentRunRequest {
  readonly label: CandidateLabel
  readonly cwd: string
  readonly prompt: string
  readonly route: AgentRoute
  readonly signal: AbortSignal
  /** Opaque value from StartInput.hostContext (DSH: the parent Agent). */
  readonly hostContext?: unknown
  /** Called while the agent works, whenever its observed activity changes. */
  readonly onProgress?: (p: AgentProgress) => void
}

export interface AgentProgress {
  readonly steps: number
  readonly lastAction?: string
  readonly tokens?: number
}

export interface AgentRunResult {
  readonly stopReason: string
  readonly summary?: string
  readonly usage: Usage
  readonly childId?: string
  /** The route the agent actually ran with, when the host reports it. */
  readonly actualRoute?: AgentRoute
}

/** The one seam to the agent host. DSH implements it with its own sessions; tests script it. */
export interface AgentRunner {
  /**
   * `own-root`: the agent's write boundary is `cwd` itself, enforced by the
   * host before anything runs. `shared-root`: the agent can write wherever its
   * parent can, so copies must live inside the repository and escapes are only
   * detected afterwards.
   */
  readonly isolation: 'own-root' | 'shared-root'
  run(request: AgentRunRequest): Promise<AgentRunResult>
}

export interface StartInput {
  readonly repo: string
  readonly task: string
  /** `same-model` (default): one route, two strategies. `cross-model`: two routes, one brief. */
  readonly mode?: 'same-model' | 'cross-model'
  readonly strategies?: readonly [Strategy, Strategy]
  /** same-model: routes[0] for both. cross-model: two different routes (required). */
  readonly routes?: readonly [AgentRoute, AgentRoute]
  readonly checks?: ChecksSpec
  readonly sessionId?: string
  readonly follows?: string
  readonly origin?: RunRecord['origin']
  readonly generationMs?: number
  /** Fixed A/B assignment for tests; production shuffles. */
  readonly assignment?: 'fixed' | 'shuffle'
  /** Handed to every AgentRunner call; never persisted. */
  readonly hostContext?: unknown
}

export interface ComparerOptions {
  readonly store?: RunStore
  readonly runner: AgentRunner
  readonly version: string
  readonly onUpdate?: (record: RunRecord) => void
  readonly previewTimeoutMs?: number
  /** Disable the headless-browser check (tests without a system browser). */
  readonly browserChecks?: boolean
  /** Comparisons generating at the same time in this process. Default 1. */
  readonly maxActiveRuns?: number
  /** Per-candidate generation budget. Default 30 minutes. */
  readonly generationMs?: number
}

interface LiveRun {
  readonly record: RunRecord
  readonly hostContext: unknown
  readonly controller: AbortController
  readonly perCandidate: Map<CandidateLabel, AbortController>
  readonly previews: Map<string, Preview>
  done: Promise<void>
}

const SUMMARY_MAX = 1200
export const DEFAULT_GENERATION_MS = 30 * 60_000
const REVEALED_STATES = new Set(['revealed', 'adopting', 'adopted', 'recovery'])
const SETTLED = new Set<CandidateStage>(['ready', 'failed', 'cancelled', 'interrupted'])

export class Comparer {
  readonly store: RunStore
  private readonly live = new Map<string, LiveRun>()
  private readonly queues = new Map<string, Promise<unknown>>()

  constructor(private readonly opts: ComparerOptions) {
    this.store = opts.store ?? new RunStore()
  }

  /** Validate, snapshot the baseline, bind the acceptance, persist, then work in the background. */
  async start(input: StartInput): Promise<RunRecord> {
    const task = input.task.trim()
    if (task === '') throw new Error('任务描述为空')
    const active = [...this.live.values()].filter((l) => l.record.state === 'running').length
    if (active >= (this.opts.maxActiveRuns ?? 1)) throw new BusyError('已有一轮比较正在生成，请等它结束或停止后再开始新的一轮')
    const root = await repoRoot(input.repo)
    const info = await inspectProject(root)
    if (info.kind === 'unsupported') throw new Error(info.reason ?? 'unsupported project')

    const mode = input.mode ?? 'same-model'
    let routes: [AgentRoute, AgentRoute]
    let strategies: readonly [Strategy, Strategy]
    if (mode === 'cross-model') {
      const [a, b] = input.routes ?? [{}, {}]
      if (a.model === undefined || b.model === undefined) throw new Error('两个模型模式需要分别选择两个模型')
      if (a.provider === b.provider && a.model === b.model && a.reasoningEffort === b.reasoningEffort) throw new Error('两个模型模式需要选择两个不同的模型')
      routes = [a, b]
      strategies = [BALANCED, BALANCED]
    } else {
      const r = input.routes?.[0] ?? {}
      routes = [r, r]
      strategies = input.strategies ?? DEFAULT_STRATEGIES
    }

    const runId = newRunId()
    const scratch = this.store.artifacts(runId)
    await mkdir(scratch, { recursive: true })
    const head = await headCommit(root)
    const tree = await snapshotTree(root, scratch, ALWAYS_EXCLUDED)
    const dirty = head === undefined ? true : tree !== (await treeOf(root, head))
    const acceptance = await buildAcceptance(root, tree, info, input.checks)
    const snapshotCommit = await commitTree(root, tree, [head], `agent-compare baseline ${runId}`)
    await pinRef(root, `refs/agent-compare/${runId}/base`, snapshotCommit)

    const order: [number, number] = input.assignment === 'fixed' || Math.random() < 0.5 ? [0, 1] : [1, 0]
    const mk = (label: CandidateLabel, i: number): Candidate => ({ label, strategy: strategies[i]!, route: routes[i]!, stage: 'queued', timings: {} })
    const record: RunRecord = {
      schema: RUN_SCHEMA,
      producer: { name: 'dsh-agent-compare', version: this.opts.version },
      runId,
      createdAt: Date.now(),
      task,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.follows === undefined ? {} : { follows: input.follows }),
      ...(input.origin === undefined ? {} : { origin: input.origin }),
      baseline: { repoRoot: root, headCommit: head, snapshotCommit, snapshotTree: tree, dirty },
      acceptance,
      mode,
      isolation: this.opts.runner.isolation,
      budget: { generationMs: input.generationMs ?? this.opts.generationMs ?? DEFAULT_GENERATION_MS },
      state: 'running',
      candidates: [mk('A', order[0]), mk('B', order[1])],
      rev: 0,
      updatedAt: Date.now(),
    }
    const lr: LiveRun = { record, hostContext: input.hostContext, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
    this.live.set(runId, lr)
    await this.persist(record)
    lr.done = this.drive(lr).catch(() => {})
    return record
  }

  /** Resolve once every candidate has settled (ready, failed or cancelled). */
  async wait(runId: string): Promise<RunRecord | undefined> {
    await this.live.get(runId)?.done
    return this.get(runId)
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    return this.live.get(runId)?.record ?? this.store.load(runId)
  }

  /** Run `fn` after every earlier operation on the same run in this process. */
  private serial<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(runId) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    this.queues.set(runId, next.catch(() => {}))
    return next
  }

  private persist(record: RunRecord): Promise<void> {
    return this.serial(record.runId, async () => {
      await this.store.save(record)
      this.opts.onUpdate?.(record)
    })
  }

  private async drive(lr: LiveRun): Promise<void> {
    const record = lr.record
    await Promise.all(record.candidates.map((c) => this.driveCandidate(lr, c)))
    if (record.state === 'running') {
      record.state = 'judging'
      record.checksFavoured = favoured(record.candidates)
    }
    await this.persist(record)
  }

  private async driveCandidate(lr: LiveRun, c: Candidate): Promise<void> {
    const record = lr.record
    const ctl = new AbortController()
    lr.perCandidate.set(c.label, ctl)
    const signal = AbortSignal.any([lr.controller.signal, ctl.signal])
    const enter = async (stage: CandidateStage): Promise<void> => {
      const prev = c.timings[c.stage]
      if (prev && prev.endedAt === undefined) prev.endedAt = Date.now()
      if (c.stage !== 'stopping') c.stage = stage
      c.timings[stage] = { startedAt: Date.now() }
      await this.persist(record)
    }
    const repo = record.baseline.repoRoot
    try {
      await enter('preparing')
      const dir = record.isolation === 'own-root'
        ? path.join(this.store.copies(record.runId), c.label)
        : path.join(await ensureWorktreePool(repo), `ac-${record.runId}-${c.label}`)
      c.dir = dir
      c.ownerToken = randomBytes(12).toString('hex')
      // Recorded before the copy exists, so a crash right after creation still leaves a provable owner.
      await this.persist(record)
      await addOwnedWorktree(repo, dir, record.baseline.snapshotCommit, { runId: record.runId, label: c.label, token: c.ownerToken })
      signal.throwIfAborted()

      await enter('generating')
      signal.throwIfAborted()
      const budget = AbortSignal.timeout(record.budget.generationMs)
      let lastSave = 0
      const result = await this.opts.runner.run({
        label: c.label,
        cwd: dir,
        prompt: candidatePrompt(record.task, c.strategy, record.isolation),
        route: c.route,
        signal: AbortSignal.any([signal, budget]),
        hostContext: lr.hostContext,
        onProgress: (p) => {
          c.progress = { steps: p.steps, lastActivityAt: Date.now(), ...(p.lastAction === undefined ? {} : { lastAction: p.lastAction.slice(0, 160) }), ...(p.tokens === undefined ? {} : { tokens: p.tokens }) }
          if (Date.now() - lastSave > 3000) {
            lastSave = Date.now()
            void this.persist(record).catch(() => {})
          }
        },
      })
      c.stopReason = result.stopReason
      c.usage = result.usage
      if (result.childId !== undefined) c.childId = result.childId
      if (result.actualRoute !== undefined) c.actualRoute = result.actualRoute
      if (result.summary !== undefined) c.summary = result.summary.slice(0, SUMMARY_MAX)
      await this.noteOutsideChanges(record)
      signal.throwIfAborted()
      // How generation ended is a fact to show, not a verdict: whatever the
      // agent wrote is sealed and verified by the same acceptance either way.
      c.generation = budget.aborted
        ? { ended: 'budget' }
        : result.stopReason === 'completed' ? { ended: 'completed' } : { ended: 'agent-stopped', stopReason: result.stopReason }
      await this.sealAndVerify(lr, c, signal, enter)
    } catch (error) {
      const stage = c.stage === 'stopping' ? (Object.entries(c.timings).find(([, t]) => t?.endedAt === undefined)?.[0] as CandidateStage | undefined) ?? 'queued' : c.stage
      // `signal` is the user's stop; the generation budget is separate and ends as a failure.
      if (signal.aborted) {
        c.stage = 'cancelled'
      } else {
        c.stage = 'failed'
        c.error = { stage: error instanceof StageFailure ? error.stage : stage, message: String((error as Error).message ?? error).slice(0, 2000) }
      }
      for (const t of Object.values(c.timings)) if (t && t.endedAt === undefined) t.endedAt = Date.now()
      await this.stopPreview(lr, c.label)
      delete c.preview
      await this.persist(record)
    }
  }

  /** Freeze what the copy holds, then run the full acceptance on it. Ends in `ready` or throws. */
  private async sealAndVerify(lr: LiveRun, c: Candidate, signal: AbortSignal, enter: (s: CandidateStage) => Promise<void>): Promise<void> {
    const record = lr.record
    const repo = record.baseline.repoRoot
    const dir = c.dir!
    await enter('sealing')
    const change = await captureChange(dir, record.baseline.snapshotCommit, `agent-compare candidate ${record.runId}/${c.label}`)
    if (change.touched.length === 0) {
      // The agent's own account is the only clue to why (e.g. sandbox denials); show its start.
      const why = (c.summary ?? '').replace(/```[\s\S]*?```/g, '').trim().slice(0, 600)
      const ended = c.generation?.ended === 'budget'
        ? `超出生成时间预算（${Math.round(record.budget.generationMs / 60_000)} 分钟）时还没有改动任何文件。`
        : c.generation?.ended === 'agent-stopped' ? `Agent 没有正常结束（${c.generation.stopReason}），也没有改动任何文件。` : 'Agent 没有改动任何文件。'
      throw new StageFailure('sealing', `${ended}${why ? `\nAgent 的说明：${why}` : ''}`)
    }
    const artifacts = this.store.artifacts(record.runId)
    c.patchFile = path.join(artifacts, `${c.label}.patch`)
    c.patchSha256 = await writePatch(c.patchFile, change.patch)
    c.patchStats = change.stats
    c.touchedFiles = change.touched
    c.candidateCommit = change.commit
    c.candidateTree = change.tree
    await pinRef(repo, `refs/agent-compare/${record.runId}/${c.label}`, change.commit)
    const acc = await acceptanceChanges(repo, record.acceptance, record.baseline.snapshotTree, change.tree)
    c.acceptanceTouched = acc.touched
    c.dependencyChange = acc.dependencyChange

    const v = await this.verifyCopy(record.acceptance, dir, change.tree, path.join(artifacts, c.label), signal, enter)
    if (v.preview) lr.previews.set(c.label, v.preview.handle)
    c.install = v.install
    c.checks = v.checks
    c.checkedTree = v.checkedTree
    c.drift = v.drift
    if (v.preview) c.preview = v.preview.info
    if (v.screenshot) c.screenshot = v.screenshot
    if (v.mobileScreenshot) c.mobileScreenshot = v.mobileScreenshot
    c.verdict = verdictOf(c, record.acceptance)
    signal.throwIfAborted()
    await enter('ready')
  }

  /**
   * Seal and verify what a candidate had written when it failed during
   * generation (stopped by the budget, an earlier version, or a host
   * restart). Its copy must still be the one this run created.
   */
  async salvage(runId: string, label: CandidateLabel): Promise<RunRecord> {
    if (this.live.get(runId)?.record.state === 'running') throw new BusyError('这次比较还在进行中')
    const r = await this.mustLoad(runId)
    if (r.state !== 'judging' && r.state !== 'interrupted') throw new Error(`现在不能验收（${r.state}）`)
    const c = r.candidates.find((x) => x.label === label)
    if (c === undefined || (c.stage !== 'failed' && c.stage !== 'interrupted') || (c.error?.stage !== 'generating' && c.error?.stage !== 'sealing')) throw new Error('只有在生成阶段中止的候选可以验收已写的改动')
    if (c.dir === undefined || c.ownerToken === undefined || !existsSync(c.dir)) throw new Error('这个候选的副本已经不在了')
    const lr: LiveRun = this.live.get(runId) ?? { record: r, hostContext: undefined, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
    this.live.set(runId, lr)
    const record = lr.record
    const cand = record.candidates.find((x) => x.label === label)!
    const ctl = new AbortController()
    lr.perCandidate.set(label, ctl)
    const signal = AbortSignal.any([lr.controller.signal, ctl.signal])
    const enter = async (stage: CandidateStage): Promise<void> => {
      const prev = cand.timings[cand.stage]
      if (prev && prev.endedAt === undefined) prev.endedAt = Date.now()
      cand.stage = stage
      cand.timings[stage] = { startedAt: Date.now() }
      await this.persist(record)
    }
    const failedWhy = cand.error?.message
    delete cand.error
    cand.generation ??= { ended: /预算/.test(failedWhy ?? '') ? 'budget' : 'agent-stopped', ...(cand.stopReason ? { stopReason: cand.stopReason } : {}) }
    if (record.state === 'interrupted') record.state = 'judging'
    await enter('sealing')
    // Runs in the background like a fresh candidate; `wait(runId)` resolves when it settles.
    lr.done = (async () => {
      try {
        await this.sealAndVerify(lr, cand, signal, enter)
      } catch (error) {
        cand.stage = signal.aborted ? 'cancelled' : 'failed'
        if (!signal.aborted) cand.error = { stage: error instanceof StageFailure ? error.stage : cand.stage, message: String((error as Error).message ?? error).slice(0, 2000) }
        for (const t of Object.values(cand.timings)) if (t && t.endedAt === undefined) t.endedAt = Date.now()
        await this.stopPreview(lr, label)
        delete cand.preview
      }
      record.checksFavoured = favoured(record.candidates)
      await this.persist(record)
    })().catch(() => {})
    return record
  }

  /**
   * Install, run the shared commands, serve the build, and run the browser
   * acceptance in `dir`, whose files must equal `sealedTree`. Used for each
   * candidate and for the adoption rehearsal.
   */
  private async verifyCopy(acceptance: Acceptance, dir: string, sealedTree: string, shotBase: string, signal: AbortSignal, enter?: (s: CandidateStage) => Promise<void>): Promise<{
    install: NonNullable<Candidate['install']>
    checks: CheckResult[]
    checkedTree: string
    drift: string[]
    preview?: { info: PreviewInfo; handle: Preview }
    screenshot?: string
    mobileScreenshot?: string
  }> {
    await enter?.('installing')
    const checkedTree = await copyTree(dir)
    if (checkedTree !== sealedTree) throw new StageFailure('installing', '副本内容与封存的版本不一致，拒绝验收')
    const info = await inspectProject(dir)
    if (info.kind === 'unsupported') throw new StageFailure('installing', info.reason ?? '改动后项目不再受支持')
    const inst = installArgv(info)
    const t0 = Date.now()
    const r = await run(inst.argv, { cwd: dir, timeoutMs: 600_000, signal, env: { ...process.env, CI: '1' } })
    signal.throwIfAborted()
    if (r.code !== 0) {
      const tail = (r.stderr || r.stdout).trim().slice(-800)
      throw new StageFailure('installing', inst.frozen
        ? `按锁文件 ${info.lockfile} 冻结安装失败。改了依赖就必须同时更新锁文件，AgentCompare 不会换成非冻结安装。\n${tail}`
        : `依赖安装失败：\n${tail}`)
    }
    const install = { argv: inst.argv, frozen: inst.frozen, durationMs: Date.now() - t0 }

    await enter?.('verifying')
    const checks = await runCommandChecks(dir, acceptance.checks, signal)
    signal.throwIfAborted()
    const buildOk = checks.find((k) => k.name === 'build')?.outcome === 'passed'

    await enter?.('previewing')
    let preview: { info: PreviewInfo; handle: Preview } | undefined
    try {
      const kind = buildOk ? 'build' : 'dev'
      const handle = await startVitePreview(dir, { kind, timeoutMs: this.opts.previewTimeoutMs ?? 60_000, signal })
      preview = { handle, info: { url: handle.url, port: handle.port, pid: handle.pid, kind, cwd: dir } }
    } catch (error) {
      if (signal.aborted) throw error
      const log = error instanceof PreviewError ? `\n${error.log.slice(-800)}` : ''
      throw new StageFailure('previewing', `${(error as Error).message}${log}`)
    }
    let screenshot: string | undefined
    let mobileScreenshot: string | undefined
    try {
      if (acceptance.checks.browser !== undefined && this.opts.browserChecks !== false) {
        await mkdir(path.dirname(shotBase), { recursive: true })
        const b = await runBrowserCheck(preview.info.url, acceptance.checks.browser, `${shotBase}.png`)
        checks.push(b)
        screenshot = b.screenshot
        mobileScreenshot = b.mobileScreenshot
      }
      signal.throwIfAborted()
      // A project that does not ignore its build output would otherwise always "drift" by its own build.
      const drift = (await changedPaths(dir, sealedTree, await copyTree(dir))).filter((p) => !p.startsWith('dist/'))
      return { install, checks, checkedTree, drift, preview, ...(screenshot ? { screenshot } : {}), ...(mobileScreenshot ? { mobileScreenshot } : {}) }
    } catch (error) {
      await preview.handle.stop()
      throw error
    }
  }

  /**
   * Compare the user's checkout (copies excluded) with the baseline and record
   * every differing path. Called when each candidate finishes generating.
   */
  private async noteOutsideChanges(record: RunRecord): Promise<void> {
    try {
      const repo = record.baseline.repoRoot
      const now = await snapshotTree(repo, this.store.artifacts(record.runId), ALWAYS_EXCLUDED)
      if (now === record.baseline.snapshotTree) return
      const changed = await changedPaths(repo, record.baseline.snapshotTree, now)
      const merged = new Set([...(record.outsideChanges ?? []), ...changed])
      if (merged.size !== (record.outsideChanges?.length ?? 0)) record.outsideChanges = [...merged].slice(0, 200)
    } catch {
      // Detection is best effort; a failure here must not fail the candidate.
    }
  }

  private async stopPreview(lr: LiveRun | undefined, key: string): Promise<void> {
    const p = lr?.previews.get(key)
    if (p) {
      await p.stop()
      lr?.previews.delete(key)
    }
  }

  /** Stop one candidate or the whole run. Shows "stopping" until each candidate has actually settled. */
  async cancel(runId: string, label?: CandidateLabel): Promise<RunRecord | undefined> {
    const lr = this.live.get(runId)
    if (lr === undefined) return this.get(runId)
    for (const c of lr.record.candidates) {
      if ((label === undefined || c.label === label) && !SETTLED.has(c.stage)) c.stage = 'stopping'
    }
    await this.persist(lr.record)
    if (label === undefined) lr.controller.abort()
    else lr.perCandidate.get(label)?.abort()
    return lr.record
  }

  /** Record the blind choice and reveal at once. Any finished candidate can be picked; adoption rules come later. */
  async choose(runId: string, pick: CandidateLabel | 'none', note?: string): Promise<RunRecord> {
    return this.mutate(runId, (r) => {
      if (r.state !== 'judging') throw new Error(r.state === 'revealed' ? '已经选过了' : `现在不能选择（${r.state}）`)
      if (pick !== 'none' && r.candidates.find((c) => c.label === pick)?.stage !== 'ready') throw new Error(`候选 ${pick} 还没有可体验的结果`)
      r.choice = { pick, at: Date.now(), ...(note === undefined ? {} : { note }) }
      r.state = 'revealed'
      r.revealedAt = Date.now()
    })
  }

  /**
   * Serve a finished candidate again (its preview stopped with a host
   * restart, or was never started). Uses the copy's existing build output
   * when there is one; the copy must still be the one this run created.
   */
  async reopenPreview(runId: string, label: CandidateLabel): Promise<RunRecord> {
    const r = await this.mustLoad(runId)
    return this.serial(runId, async () => {
      const lr: LiveRun = this.live.get(runId) ?? { record: r, hostContext: undefined, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
      this.live.set(runId, lr)
      const c = lr.record.candidates.find((x) => x.label === label)
      if (c === undefined || c.stage !== 'ready') throw new Error('只有已完成验收的候选可以重新打开预览')
      if (lr.previews.has(label) && c.preview !== undefined) return lr.record
      if (c.dir === undefined || !existsSync(c.dir)) throw new Error('这个候选的副本已经清理，只能查看截图')
      const kind = c.checks?.find((k) => k.name === 'build')?.outcome === 'passed' && existsSync(path.join(c.dir, 'dist')) ? 'build' : 'dev'
      const handle = await startVitePreview(c.dir, { kind, timeoutMs: this.opts.previewTimeoutMs ?? 60_000 })
      lr.previews.set(label, handle)
      c.preview = { url: handle.url, port: handle.port, pid: handle.pid, kind, cwd: c.dir }
      await this.save(lr.record)
      return lr.record
    })
  }

  /** Report-only adoption check: overlap, eligibility and whether a rehearsal will run. Writes nothing. */
  async adoptPreflight(runId: string): Promise<{ ok: boolean; eligible: boolean; reasons: string[]; overlapping?: string[]; targetChanged?: boolean; rehearsal?: boolean }> {
    const r = await this.mustLoad(runId)
    const c = r.candidates.find((x) => x.label === r.choice?.pick)
    if (!c?.candidateCommit) return { ok: false, eligible: false, reasons: ['没有选中的候选'] }
    const nameStatus = await nameStatusOf(r.baseline.repoRoot, r.baseline.snapshotCommit, c.candidateCommit)
    const p = await preflight({ baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: this.store.artifacts(runId) })
    const verdict = c.verdict ?? { eligible: false, reasons: ['没有验收结论'], warnings: [] }
    return p.ok
      ? { ok: verdict.eligible, eligible: verdict.eligible, reasons: verdict.reasons, targetChanged: p.targetChanged, rehearsal: p.expectedTree !== c.candidateTree }
      : { ok: false, eligible: verdict.eligible, reasons: verdict.reasons, overlapping: p.overlapping }
  }

  /**
   * Land the chosen candidate.
   *
   * `worktree` (eligible candidates only): compute the tree the checkout will
   * have afterwards; when it differs from the checked candidate (the user
   * changed other files since), build and check it in a scratch copy first.
   * Only then persist a journal, write, and verify the checkout equals that
   * tree. HEAD, the index and commits are never touched.
   *
   * `branch`: create a branch with the candidate, switching nothing. Allowed
   * for any finished candidate, so an unverified one can still be inspected.
   */
  async adopt(runId: string, mode: 'worktree' | 'branch' = 'worktree'): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return this.store.withLock(`repo-${repoKey(first.baseline.repoRoot)}`, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      if (r.state !== 'revealed') throw new AdoptError('state', `现在不能采用（${r.state}）`)
      const pick = r.choice?.pick
      if (pick === undefined || pick === 'none') throw new AdoptError('state', '没有选中的候选')
      const c = r.candidates.find((x) => x.label === pick)!
      if (c.stage !== 'ready' || c.candidateCommit === undefined || c.candidateTree === undefined || c.patchFile === undefined || c.patchSha256 === undefined) throw new AdoptError('state', '这个候选没有可采用的结果')
      if (!existsSync(c.patchFile) || (await readPatchSha(c.patchFile)) !== c.patchSha256) throw new AdoptError('integrity', '记录的补丁和验收时的不一致')
      if ((await treeOf(r.baseline.repoRoot, c.candidateCommit)) !== c.candidateTree) throw new AdoptError('integrity', '候选提交和封存的内容不一致')
      const repo = r.baseline.repoRoot
      const scratch = this.store.artifacts(runId)
      const nameStatus = await nameStatusOf(repo, r.baseline.snapshotCommit, c.candidateCommit)
      const touched = nameStatus.map((n) => n.path)

      if (mode === 'branch') {
        const verified = c.verdict?.eligible === true
        const { branch } = await adoptAsBranch({ baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: scratch, branch: `agent-compare/${runId}-${pick}`, ...(verified ? {} : { note: 'not verified' }) })
        r.adoption = { label: pick, mode, state: 'adopted', startedAt: Date.now(), endedAt: Date.now(), branch, message: `已创建分支 ${branch}（含一个提交）；当前 checkout、文件和 index 均未改动${verified ? '' : '。注意：这一版没有通过共同验收'}` }
        r.state = 'adopted'
        await this.save(r)
        return r
      }

      if (c.verdict?.eligible !== true) {
        throw new AdoptError('ineligible', `这一版没有通过共同验收，不能写入工作区：${(c.verdict?.reasons ?? ['没有验收结论']).join('；')}。可以另存为分支查看。`)
      }
      r.adoption = { label: pick, mode, state: 'rehearsing', startedAt: Date.now() }
      r.state = 'adopting'
      await this.save(r)
      const blocked = async (message: string, attention?: string[]): Promise<RunRecord> => {
        r.adoption!.state = 'blocked'
        r.adoption!.endedAt = Date.now()
        r.adoption!.message = `${message}尚未写入任何文件。`
        if (r.adoption!.writtenPaths !== undefined) r.adoption!.writtenPaths = []
        if (attention) r.adoption!.attention = attention
        r.state = 'revealed'
        await this.save(r)
        return r
      }

      const pf = await preflight({ baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: scratch })
      if (!pf.ok) return blocked(`基线之后你改过这些文件，和这一版的改动重叠：${pf.overlapping.slice(0, 10).join('、')}。`, pf.overlapping)

      if (pf.expectedTree === c.candidateTree) {
        r.adoption.rehearsal = { reused: true, tree: pf.expectedTree }
      } else {
        const rehearsal = await this.rehearse(r, pf.expectedTree, pf.target.head)
        r.adoption.rehearsal = rehearsal.record
        if (!rehearsal.ok) return blocked(`把这一版接到你当前的项目上预演后，验收没有通过：${rehearsal.reasons.join('；')}。`)
      }

      const changed = await targetChanges(repo, scratch, pf.target)
      if (changed.length > 0) return blocked(`预演期间项目发生了变化，请检查后重新采用：${changed.slice(0, 10).join('、')}。`, changed)

      // Journal: everything needed to undo is durable before the first byte changes.
      const preAdopt = await pinPreAdopt(repo, pf.target)
      await pinRef(repo, `refs/agent-compare/${runId}/pre-adopt`, preAdopt)
      Object.assign(r.adoption, { state: 'writing', preAdoptCommit: preAdopt, expectedTree: pf.expectedTree, headBefore: pf.target.head, stagedBefore: pf.target.staged, writtenPaths: [] })
      await this.save(r)

      let problem: string | undefined
      let attempted: string[] = []
      let completed = false
      try {
        attempted = await writeCandidate(repo, c.candidateCommit, nameStatus, {
          expected: pf.target,
          scratchDir: scratch,
          beforeWrite: async (paths) => {
            r.adoption!.writtenPaths = [...paths]
            await this.save(r)
          },
        })
        const chk = await checkWritten(repo, scratch, { expectedTree: pf.expectedTree, candidateCommit: c.candidateCommit, touched, before: pf.target })
        if (chk.mismatched.length > 0) problem = `写入后这些文件和验收过的版本不一致：${chk.mismatched.slice(0, 10).join('、')}`
        else {
          r.adoption.endedAt = Date.now()
          const others = [...chk.concurrent, ...(chk.headChanged ? ['HEAD'] : []), ...(chk.stagedChanged ? ['index'] : [])]
          if (others.length > 0) {
            r.adoption.state = 'needs-attention'
            r.adoption.attention = others
            r.adoption.message = `已写入 ${touched.length} 个文件，内容与验收过的一致；但写入期间这些位置也变了，组合结果没有经过预演：${others.slice(0, 10).join('、')}`
          } else {
            r.adoption.state = 'adopted'
            r.adoption.message = `已写入 ${touched.length} 个文件，项目现在与${r.adoption.rehearsal?.reused ? '验收过的版本' : '预演通过的版本'}完全一致；未提交，index 和 HEAD 未改动`
          }
          r.state = 'adopted'
          await this.save(r)
          completed = true
        }
      } catch (error) {
        if (error instanceof CandidateWriteError) {
          attempted = error.attemptedPaths
          if (attempted.length === 0) return blocked(`写入前检查已停止采用：${error.message}${error.changedLocations?.length ? `（${error.changedLocations.slice(0, 10).join('、')}）` : ''}。`, error.changedLocations ? [...error.changedLocations] : undefined)
          if (error.changedLocations) r.adoption.attention = [...error.changedLocations]
        }
        problem = `写入失败：${(error as Error).message}`
      }
      // Once the successful write is durable, cleanup cannot turn it into a
      // failed adoption or roll back the user's selected result.
      if (completed) {
        try { await this.releaseResources(r) } catch (error) {
          r.leftovers = [...(r.leftovers ?? []), `资源回收未完成：${(error as Error).message}`]
        }
        await this.save(r)
        return r
      }
      // Drop the pending intent when its precondition failed before the write began.
      r.adoption.writtenPaths = attempted
      await this.save(r)
      const undo = await undoAdoption(repo, scratch, { preAdoptCommit: preAdopt, candidateCommit: c.candidateCommit, touched: attempted })
      r.adoption.endedAt = Date.now()
      if (undo.conflicts.length === 0) {
        r.adoption.state = 'rolled-back'
        r.adoption.message = `${problem}。已把本次尝试写入的 ${attempted.length} 个文件恢复到采用前。`
        r.state = 'revealed'
      } else {
        r.adoption.state = 'needs-recovery'
        r.adoption.attention = undo.conflicts
        r.adoption.message = `${problem}。这些文件无法自动恢复，请检查：${undo.conflicts.slice(0, 10).join('、')}`
        r.state = 'recovery'
      }
      await this.save(r)
      return r
    }), { busyMessage: '这个仓库正在进行另一项采用或恢复操作，请稍后再试' })
  }

  /** Build `tree` in a scratch copy and run the full acceptance on it. */
  private async rehearse(r: RunRecord, tree: string, head: string | undefined): Promise<{ ok: boolean; reasons: string[]; record: NonNullable<NonNullable<RunRecord['adoption']>['rehearsal']> }> {
    const repo = r.baseline.repoRoot
    const dir = path.join(this.store.copies(r.runId), 'R')
    const token = randomBytes(12).toString('hex')
    const record = { reused: false, tree, dir, ownerToken: token }
    r.adoption!.rehearsal = record
    await this.save(r)
    const commit = await commitTree(repo, tree, [head], `agent-compare rehearsal ${r.runId}`)
    await pinRef(repo, `refs/agent-compare/${r.runId}/rehearsal`, commit)
    await addOwnedWorktree(repo, dir, commit, { runId: r.runId, label: 'R', token })
    const ctl = new AbortController()
    try {
      const v = await this.verifyCopy(r.acceptance, dir, tree, path.join(this.store.artifacts(r.runId), 'R'), ctl.signal)
      await v.preview?.handle.stop()
      const reasons = [
        ...v.checks.filter((k) => k.outcome === 'failed' || k.outcome === 'timeout').map((k) => `${k.name} 未通过${k.reason ? `（${k.reason.slice(0, 120)}）` : ''}`),
        ...(v.drift.length > 0 ? [`验收过程中多出了文件：${v.drift.slice(0, 5).join('、')}`] : []),
      ]
      return { ok: reasons.length === 0, reasons, record: { ...record, checks: v.checks } }
    } catch (error) {
      return { ok: false, reasons: [(error as Error).message.split('\n')[0] ?? '预演失败'], record }
    } finally {
      await removeOwnedWorktree(repo, dir, { runId: r.runId, label: 'R', token })
      await dropRefs(repo, `refs/agent-compare/${r.runId}/rehearsal`)
    }
  }

  /**
   * Undo a worktree adoption. Refuses (and lists the paths) when any touched
   * file was edited after adoption, so nothing the user wrote is overwritten.
   */
  async revert(runId: string): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return this.store.withLock(`repo-${repoKey(first.baseline.repoRoot)}`, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      const a = r.adoption
      if (r.state !== 'adopted' || a?.mode !== 'worktree' || a.preAdoptCommit === undefined || a.writtenPaths === undefined) throw new AdoptError('state', '只有写入工作区的采用可以撤销')
      const c = r.candidates.find((x) => x.label === a.label)!
      const repo = r.baseline.repoRoot
      const candidateTree = await treeOf(repo, c.candidateCommit!)
      const now = await snapshotTree(repo, this.store.artifacts(runId), ALWAYS_EXCLUDED)
      const edited = await changedPaths(repo, candidateTree, now, a.writtenPaths)
      if (edited.length > 0) throw new AdoptError('overlap', `采用之后你改过这些文件，为避免覆盖，没有撤销：${edited.slice(0, 10).join('、')}`)
      const undo = await undoAdoption(repo, this.store.artifacts(runId), { preAdoptCommit: a.preAdoptCommit, candidateCommit: c.candidateCommit!, touched: a.writtenPaths })
      a.state = undo.conflicts.length === 0 ? 'reverted' : 'needs-recovery'
      a.message = undo.conflicts.length === 0 ? `已撤销：${undo.restored.length} 个文件恢复到采用前的内容` : `部分文件无法恢复：${undo.conflicts.slice(0, 10).join('、')}`
      if (undo.conflicts.length > 0) a.attention = undo.conflicts
      r.state = undo.conflicts.length === 0 ? 'revealed' : 'recovery'
      await this.save(r)
      return r
    }), { busyMessage: '这个仓库正在进行另一项采用或恢复操作，请稍后再试' })
  }

  /**
   * Resolve a run left in `recovery`. `restore` puts every touched path that
   * still holds our content back to its pre-adopt state (paths edited by
   * someone else are listed, not touched); `keep` accepts the files as they are.
   */
  async recoverAdoption(runId: string, action: 'restore' | 'keep'): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return this.store.withLock(`repo-${repoKey(first.baseline.repoRoot)}`, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      const a = r.adoption
      if (r.state !== 'recovery' || a === undefined) throw new AdoptError('state', '这次比较没有需要恢复的采用')
      if (action === 'keep') {
        a.state = 'needs-attention'
        a.message = '你选择保留当前文件；AgentCompare 没有再改动任何文件'
        r.state = 'adopted'
      } else {
        const c = r.candidates.find((x) => x.label === a.label)!
        if (a.preAdoptCommit === undefined || a.writtenPaths === undefined) {
          a.state = 'rolled-back'
          a.message = '中断发生在写入之前，没有文件被改动'
          r.state = 'revealed'
        } else {
          const undo = await undoAdoption(r.baseline.repoRoot, this.store.artifacts(runId), { preAdoptCommit: a.preAdoptCommit, candidateCommit: c.candidateCommit!, touched: a.writtenPaths })
          if (undo.conflicts.length === 0) {
            a.state = 'rolled-back'
            a.message = `已恢复：${undo.restored.length} 个文件回到采用前的内容`
            delete a.attention
            r.state = 'revealed'
          } else {
            a.attention = undo.conflicts
            a.message = `已恢复 ${undo.restored.length} 个文件；这些文件既不是采用前的内容也不是候选的内容，没有改动它们：${undo.conflicts.slice(0, 10).join('、')}`
          }
        }
      }
      a.endedAt = Date.now()
      await this.save(r)
      return r
    }), { busyMessage: '这个仓库正在进行另一项采用或恢复操作，请稍后再试' })
  }

  /**
   * Stop previews and delete the copies this run can prove it created. The
   * record, patches and screenshots stay. Paths whose ownership cannot be
   * proven are kept and listed in `leftovers`.
   */
  async cleanup(runId: string): Promise<RunRecord | undefined> {
    const lr = this.live.get(runId)
    if (lr !== undefined) {
      lr.controller.abort()
      await lr.done
    }
    const r = await this.get(runId)
    if (r === undefined) return undefined
    return this.serial(runId, async () => {
      await this.releaseResources(r)
      if (r.state === 'running' || r.state === 'judging' || r.state === 'revealed' || r.state === 'interrupted') {
        r.state = 'abandoned'
        await dropRefs(r.baseline.repoRoot, `refs/agent-compare/${runId}/`)
      }
      if (!r.leftovers?.length) this.live.delete(runId)
      await this.store.save(r)
      return r
    })
  }

  /** Stop this run's previews and delete its owned copies; keep the record. */
  private async releaseResources(r: RunRecord): Promise<void> {
    const lr = this.live.get(r.runId)
    const leftovers: string[] = []
    const repo = r.baseline.repoRoot
    for (const c of r.candidates) {
      try {
        if (lr?.previews.has(c.label)) await this.stopPreview(lr, c.label)
        else if (c.preview !== undefined) await stopOwnedPreview(c.preview)
      } catch (error) {
        leftovers.push(`候选 ${c.label} 预览未停止：${(error as Error).message}`)
        // Retain its address and copy so a later cleanup can retry.
        continue
      }
      delete c.preview
      if (c.dir !== undefined && c.ownerToken !== undefined) {
        try {
          const res = await removeOwnedWorktree(repo, c.dir, { runId: r.runId, label: c.label, token: c.ownerToken })
          if (!res.removed) leftovers.push(`${c.dir}（${res.reason ?? '删除失败'}）`)
        } catch (error) { leftovers.push(`${c.dir}（${(error as Error).message}）`) }
      }
    }
    const reh = r.adoption?.rehearsal
    if (reh?.dir !== undefined && reh.ownerToken !== undefined) {
      const res = await removeOwnedWorktree(repo, reh.dir, { runId: r.runId, label: 'R', token: reh.ownerToken })
      if (!res.removed) leftovers.push(`${reh.dir}（${res.reason ?? '删除失败'}）`)
    }
    // Non-recursive on purpose: only an empty run folder is removed.
    await rmdir(this.store.copies(r.runId)).catch(() => {})
    if (leftovers.length > 0) r.leftovers = leftovers
    else delete r.leftovers
  }

  /**
   * After a host restart: anything still marked in flight did not finish.
   * Previews are stopped only when the process is provably ours; an
   * interrupted write becomes `recovery`, never "done" or "failed".
   */
  async recover(): Promise<string[]> {
    const touched: string[] = []
    for (const r of await this.store.list()) {
      if (this.live.has(r.runId)) continue
      let changed = false
      for (const c of r.candidates) {
        if (!SETTLED.has(c.stage)) {
          c.error = { stage: c.stage, message: '宿主在这一步进行时停止了' }
          c.stage = 'interrupted'
          changed = true
        }
        if (c.preview !== undefined) {
          try {
            await stopOwnedPreview(c.preview)
            delete c.preview
          } catch (error) {
            const detail = `候选 ${c.label} 预览等待清理：${(error as Error).message}`
            r.leftovers = [...new Set([...(r.leftovers ?? []), detail])]
          }
          changed = true
        }
      }
      if (r.state === 'running') {
        r.state = 'interrupted'
        changed = true
      }
      if (r.state === 'adopting' && r.adoption) {
        if (r.adoption.state === 'writing') {
          r.adoption.state = 'needs-recovery'
          r.adoption.message = '写入过程中宿主停止了。可以恢复到采用前，或保留当前文件。'
          r.state = 'recovery'
        } else {
          r.adoption.state = 'blocked'
          r.adoption.message = '预演过程中宿主停止了。尚未写入任何文件。'
          r.state = 'revealed'
        }
        changed = true
      }
      if (changed) {
        await this.store.save(r)
        touched.push(r.runId)
      }
    }
    return touched
  }

  async dispose(): Promise<void> {
    for (const [, lr] of this.live) {
      lr.controller.abort()
      for (const key of [...lr.previews.keys()]) await this.stopPreview(lr, key)
    }
    await Promise.allSettled([...this.live.values()].map((lr) => lr.done))
  }

  private async mustLoad(runId: string): Promise<RunRecord> {
    const r = await this.get(runId)
    if (r === undefined) {
      if (await this.store.loadLegacy(runId)) throw new Error('这是旧版本留下的记录，只能查看')
      throw new Error(`unknown run ${runId}`)
    }
    return r
  }

  /** The live record, or a fresh read from disk (another process may have saved). */
  private async fresh(runId: string): Promise<RunRecord> {
    return this.live.get(runId)?.record ?? (await this.store.load(runId)) ?? this.mustLoad(runId)
  }

  private async save(r: RunRecord): Promise<void> {
    await this.store.save(r)
    this.opts.onUpdate?.(r)
  }

  private async mutate(runId: string, fn: (r: RunRecord) => void): Promise<RunRecord> {
    await this.mustLoad(runId)
    return this.serial(runId, async () => {
      const r = await this.fresh(runId)
      fn(r)
      await this.save(r)
      return r
    })
  }
}

class StageFailure extends Error {
  constructor(readonly stage: CandidateStage, message: string) {
    super(message)
  }
}

/** The non-ignored content of a copy, as a tree (uses the copy's own index). */
async function copyTree(dir: string): Promise<string> {
  await git(dir, ['add', '-A', '--', '.', ...ALWAYS_EXCLUDED])
  return (await git(dir, ['write-tree'])).trim()
}

/** Kill a recorded preview only when its process provably is that preview. */
async function stopOwnedPreview(p: PreviewInfo): Promise<void> {
  const bin = path.join(p.cwd, 'node_modules', 'vite', 'bin', 'vite.js')
  const observed = await observeProcess(p.pid)
  if (observed.state === 'unavailable') throw new Error(`无法确认进程 ${p.pid} 的归属：${observed.reason}`)
  if (observed.state === 'observed' && commandHasMarkers(observed.commandLine, [bin, `--port ${p.port}`])) {
    await killTree(p.pid)
    if (!await waitGone(p.pid, 5000)) throw new Error(`预览进程 ${p.pid} 未退出`)
  }
}

/** Which candidate the checks favour: eligibility first, then passes minus failures. */
function favoured(cands: readonly Candidate[]): RunRecord['checksFavoured'] {
  const score = (c: Candidate): number | undefined => (c.stage === 'ready' ? (c.verdict?.eligible ? 1000 : 0) + (checksScore(c.checks) ?? 0) : undefined)
  const [a, b] = cands.map(score)
  return a === undefined && b === undefined ? 'none' : a === undefined ? 'B' : b === undefined ? 'A' : a > b ? 'A' : b > a ? 'B' : 'tie'
}

/** Decide adoption eligibility from recorded facts only. */
export function verdictOf(c: Candidate, acceptance: Acceptance): Verdict {
  const reasons: string[] = []
  const warnings: string[] = []
  const NAMES: Record<string, string> = { typecheck: '类型检查', lint: 'Lint', test: '测试', build: '构建', browser: '页面验收' }
  for (const k of c.checks ?? []) {
    if (k.outcome === 'failed' || k.outcome === 'timeout') reasons.push(`${NAMES[k.name] ?? k.name}${k.outcome === 'timeout' ? '超时' : '未通过'}`)
  }
  const browser = c.checks?.find((k) => k.name === 'browser')
  const scripted = acceptance.checks.browser?.steps?.length || acceptance.checks.browser?.expectSelector || acceptance.checks.browser?.expectText
  if (acceptance.checks.browser !== undefined && (browser === undefined || browser.outcome === 'skipped')) {
    if (scripted) reasons.push('页面验收没有运行')
    else warnings.push(`页面加载检查没有运行${browser?.reason ? `（${browser.reason}）` : ''}`)
  }
  if (c.preview?.kind === 'dev') reasons.push('构建未通过，只能以开发模式预览')
  if ((c.acceptanceTouched ?? []).length > 0) reasons.push(`改动了验收相关文件：${c.acceptanceTouched!.slice(0, 5).join('、')}`)
  if ((c.drift ?? []).length > 0) reasons.push(`验收过程中副本多出了未封存的改动：${c.drift!.slice(0, 5).join('、')}`)
  if (c.checkedTree === undefined || c.checkedTree !== c.candidateTree) reasons.push('验收的内容不是封存的版本')
  if (c.generation?.ended === 'budget') warnings.push('生成被时间预算截断，Agent 没有说完成；以上结论针对截断时已写的文件')
  if (c.generation?.ended === 'agent-stopped') warnings.push(`Agent 没有正常结束（${c.generation.stopReason ?? '未知'}）；以上结论针对它已写的文件`)
  if (c.dependencyChange) warnings.push('改动了依赖（已按锁文件安装）')
  if (c.install && !c.install.frozen) warnings.push('项目没有锁文件，依赖版本可能与你本地不同')
  return { eligible: c.stage !== 'failed' && reasons.length === 0, reasons, warnings }
}

async function nameStatusOf(repo: string, from: string, to: string): Promise<NameStatus[]> {
  const raw = await git(repo, ['diff', '--name-status', '-z', '--no-renames', from, to])
  const parts = raw.split('\0')
  const out: NameStatus[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) if (parts[i] && parts[i + 1]) out.push({ status: parts[i]!, path: parts[i + 1]! })
  return out
}

export interface PublicCandidate {
  readonly label: CandidateLabel
  readonly stage: CandidateStage
  readonly previewUrl?: string
  readonly previewKind?: 'build' | 'dev'
  readonly checks?: Candidate['checks']
  readonly patchStats?: Candidate['patchStats']
  readonly touchedFiles?: string[]
  readonly timings: Candidate['timings']
  readonly error?: Candidate['error']
  readonly verdict?: Verdict
  readonly usage?: Usage
  readonly hasScreenshot: boolean
  readonly hasMobileScreenshot: boolean
  readonly generation?: Candidate['generation']
  readonly progress?: Candidate['progress']
  /** Failed while generating, and its copy is still there: what it wrote can still be verified. */
  readonly salvageable: boolean
  /** Finished, not being served, and its copy still exists: the preview can be started again. */
  readonly canReopenPreview: boolean
  /** Present only after the reveal. */
  readonly strategy?: Strategy
  readonly route?: AgentRoute
  readonly actualRoute?: AgentRoute
  readonly summary?: string
}

export type PublicRun = Omit<RunRecord, 'candidates' | 'baseline' | 'acceptance' | 'adoption'> & {
  candidates: PublicCandidate[]
  baseline: { dirty: boolean; headCommit?: string; repoRoot: string }
  acceptance: { source: Acceptance['source']; checks: string[]; steps: number; sha256: string; frozenInstall: boolean }
  adoption?: Omit<NonNullable<RunRecord['adoption']>, 'rehearsal' | 'preAdoptCommit' | 'expectedTree' | 'headBefore' | 'stagedBefore'> & { rehearsed?: boolean; rehearsalChecks?: CheckResult[] }
}

/**
 * The view the UI and the model see. Before the reveal it carries nothing
 * that names the strategy or model; summaries are withheld because agents
 * tend to describe their own approach.
 */
export function publicView(r: RunRecord): PublicRun {
  const revealed = REVEALED_STATES.has(r.state) || r.revealedAt !== undefined
  const { candidates, baseline, acceptance, adoption, ...rest } = r
  const a = adoption
  return {
    ...rest,
    baseline: { dirty: baseline.dirty, repoRoot: baseline.repoRoot, ...(baseline.headCommit === undefined ? {} : { headCommit: baseline.headCommit.slice(0, 12) }) },
    acceptance: {
      source: acceptance.source,
      checks: [...acceptance.checks.commands.map((c) => c.name), ...(acceptance.checks.browser ? ['browser'] : [])],
      steps: acceptance.checks.browser?.steps?.length ?? 0,
      sha256: acceptance.sha256.slice(0, 12),
      frozenInstall: acceptance.lockfile !== undefined,
    },
    ...(a === undefined ? {} : {
      adoption: {
        label: a.label, mode: a.mode, state: a.state, startedAt: a.startedAt,
        ...(a.endedAt === undefined ? {} : { endedAt: a.endedAt }),
        ...(a.branch === undefined ? {} : { branch: a.branch }),
        ...(a.message === undefined ? {} : { message: a.message }),
        ...(a.attention === undefined ? {} : { attention: a.attention }),
        ...(a.writtenPaths === undefined ? {} : { writtenPaths: a.writtenPaths }),
        ...(a.rehearsal === undefined ? {} : { rehearsed: !a.rehearsal.reused, ...(a.rehearsal.checks ? { rehearsalChecks: a.rehearsal.checks } : {}) }),
      },
    }),
    candidates: candidates.map((c) => ({
      label: c.label,
      stage: c.stage,
      timings: c.timings,
      hasScreenshot: c.screenshot !== undefined,
      hasMobileScreenshot: c.mobileScreenshot !== undefined,
      salvageable: (r.state === 'judging' || r.state === 'interrupted') && (c.stage === 'failed' || c.stage === 'interrupted')
        && (c.error?.stage === 'generating' || c.error?.stage === 'sealing') && c.dir !== undefined && existsSync(c.dir),
      canReopenPreview: c.stage === 'ready' && c.preview === undefined && c.dir !== undefined && existsSync(c.dir),
      ...(c.generation === undefined ? {} : { generation: c.generation }),
      ...(c.progress === undefined || c.stage !== 'generating' ? {} : { progress: c.progress }),
      ...(c.preview === undefined ? {} : { previewUrl: c.preview.url, previewKind: c.preview.kind }),
      ...(c.checks === undefined ? {} : { checks: c.checks }),
      ...(c.patchStats === undefined ? {} : { patchStats: c.patchStats }),
      ...(c.touchedFiles === undefined ? {} : { touchedFiles: c.touchedFiles }),
      ...(c.error === undefined ? {} : { error: c.error }),
      ...(c.verdict === undefined ? {} : { verdict: c.verdict }),
      ...(c.usage === undefined ? {} : { usage: c.usage }),
      ...(revealed ? { strategy: c.strategy, route: c.route, ...(c.actualRoute ? { actualRoute: c.actualRoute } : {}), ...(c.summary === undefined ? {} : { summary: c.summary }) } : {}),
    })),
  }
}
