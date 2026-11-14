import { canRetryVerification, favoured, verdictOf } from './run-view.ts'
export { publicView, verdictOf, type PublicCandidate, type PublicRun } from './run-view.ts'
import { planCopyCleanup, type CopyCleanupPlan } from './copy-resources.ts'
import path from 'node:path'
import { randomBytes, randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rm, rmdir } from 'node:fs/promises'
import { addOwnedWorktree, ALWAYS_EXCLUDED, YARN_RUNTIME_FILES, captureChange, changedPaths, commitTree, dropRefs, ensureWorktreePool, git, gitTry, headCommit, ownedCopyTree, ownedWorktreeAdmin, pinRef, readPatchSha, removeOwnedWorktree, snapshotTree, treeOf, withRepositoryWrite, writePatch, type OwnedCopy } from './git.ts'
import { adoptAsBranch, AdoptError, CandidateWriteError, checkWritten, pinPreAdopt, preflight, targetChanges, undoAdoption, writeCandidate, type NameStatus } from './adopt.ts'
import { newFileTransferRef } from './file-transfer.ts'
import { installFailure } from './install-failure.ts'
import { runBrowserCheck, runCommandChecks } from './checks.ts'
import { acceptanceChanges, buildAcceptance, inspectProject, installArgv, LOCKFILES, managerVersionIssue, profileProject, scriptArgv, staticEntry, type ProfiledProject } from './project.ts'
import { isPreviewProcess, startScriptPreview, startStaticPreview, startVitePreview, PreviewError, type Preview } from './preview.ts'
import { createPrivateWorkspace, resolveWorkspace } from './workspace.ts'
import { exportFolderName, exportTree, exportUndoDirectory, freeFolder, removeExport } from './export.ts'
import { diagnosticText, killTree, observeProcess, ProcessStopError, waitGone } from './proc.ts'
import { prepareProjectProcess, runProjectProcess, type PrepareProjectProcess } from './project-process.ts'
import { WindowsCompatObserver, type WindowsProcessCompatMode } from './windows-compat.ts'
import { BusyError, newRunId, RunStore, StaleRecordError } from './run-store.ts'
import type { FileLease } from './file-lock.ts'
import { isRunId } from './record-validation.ts'
import { BALANCED, candidatePrompt, DEFAULT_STRATEGIES } from './strategies.ts'
import { CANDIDATE_LABELS, MAX_CANDIDATES, MAX_PICK_NOTE, MIN_CANDIDATES, PICK_REASONS, RUN_COORDINATION, RUN_SCHEMA, type PickReason, type Acceptance, type AgentRoute, type Candidate, type CandidateLabel, type CandidateStage, type CheckResult, type ChecksSpec, type FolderTarget, type PreviewInfo, type RunRecord, type Strategy, type Usage, type Verdict } from './types.ts'

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
   * `own-root`: the agent requests a host write boundary rooted in `cwd`,
   * subject to host platform limitations. `shared-root`: the agent can write wherever its
   * parent can, so copies must live inside the repository and escapes are only
   * detected afterwards.
   */
  readonly isolation: 'own-root' | 'shared-root'
  run(request: AgentRunRequest): Promise<AgentRunResult>
}

export interface StartInput {
  readonly repo: string
  readonly task: string
  /** `same-model` (default): one route, a style per candidate. `cross-model`: a route per candidate, one shared style. */
  readonly mode?: 'same-model' | 'cross-model'
  /** Number of candidates, 2–4. Default: the number of strategies (same-model) or routes (cross-model), else 2. */
  readonly candidates?: number
  /** same-model: one strategy per candidate. cross-model: the shared strategy is `strategies[0]` (default balanced). */
  readonly strategies?: readonly Strategy[]
  /** same-model: routes[0] for every candidate. cross-model: one distinct route per candidate (required). */
  readonly routes?: readonly AgentRoute[]
  /** `false`: an open comparison (identities shown, order kept). Default: blind. */
  readonly blind?: boolean
  readonly checks?: ChecksSpec
  readonly sessionId?: string
  readonly follows?: string
  readonly origin?: RunRecord['origin']
  readonly generationMs?: number
  readonly windowsProcessCompat?: WindowsProcessCompatMode
  /** Main-conversation excerpt for both candidates; recorded with the run. */
  readonly conversationContext?: RunRecord['conversationContext']
  /** Fixed assignment for tests; a blind comparison shuffles, an open one keeps the chosen order. */
  readonly assignment?: 'fixed' | 'shuffle'
  /** Handed to every AgentRunner call; never persisted. */
  readonly hostContext?: unknown
}

export interface ComparerOptions {
  readonly store?: RunStore
  readonly runner: AgentRunner
  readonly version: string
  readonly onUpdate?: (record: RunRecord) => void
  readonly onRecoveryIssue?: (issue: { runId: string; message: string }) => void
  readonly previewTimeoutMs?: number
  /** Disable the headless-browser check (tests without a system browser). */
  readonly browserChecks?: boolean
  /** Comparisons generating at the same time in this process. Default 1. */
  readonly maxActiveRuns?: number
  /** Per-candidate generation budget. Default 30 minutes. */
  readonly generationMs?: number
  /** Required for executable project commands; the host supplies its write boundary. */
  readonly prepareProjectProcess?: PrepareProjectProcess
}

interface LiveRun {
  managerFailure?: string
  readonly record: RunRecord
  readonly hostContext: unknown
  readonly controller: AbortController
  readonly perCandidate: Map<CandidateLabel, AbortController>
  readonly previews: Map<string, Preview>
  done: Promise<void>
}

/**
 * The candidates a start asks for: how many, and the route and strategy of
 * each, in the order the user chose them.
 */
export function candidatePlan(input: Pick<StartInput, 'mode' | 'candidates' | 'strategies' | 'routes'>): { mode: 'same-model' | 'cross-model'; routes: AgentRoute[]; strategies: Strategy[] } {
  const mode = input.mode ?? 'same-model'
  const count = input.candidates ?? (mode === 'cross-model' ? input.routes?.length : input.strategies?.length) ?? 2
  if (!Number.isSafeInteger(count) || count < MIN_CANDIDATES || count > MAX_CANDIDATES) throw new Error(`版本数需要在 ${MIN_CANDIDATES} 到 ${MAX_CANDIDATES} 之间`)
  if (mode === 'cross-model') {
    const routes = [...(input.routes ?? [])]
    if (routes.length !== count || routes.some(route => route.model === undefined)) throw new Error(`多个模型模式需要为 ${count} 个版本分别选择模型`)
    const keys = routes.map(route => `${route.provider ?? ''}\u0000${route.model}\u0000${route.reasoningEffort ?? ''}`)
    if (new Set(keys).size !== keys.length) throw new Error('多个模型模式需要选择互不相同的模型')
    const shared = input.strategies?.[0] ?? BALANCED
    return { mode, routes, strategies: routes.map(() => shared) }
  }
  const route = input.routes?.[0] ?? {}
  const strategies = [...(input.strategies ?? DEFAULT_STRATEGIES)]
  if (strategies.length !== count) throw new Error(`需要为 ${count} 个版本各选一种风格`)
  return { mode, routes: strategies.map(() => route), strategies }
}

/** A reply can be the whole result (an answer), so it is kept in full up to this bound. */
const SUMMARY_MAX = 8000
export const DEFAULT_GENERATION_MS = 30 * 60_000
const SETTLED = new Set<CandidateStage>(['ready', 'failed', 'cancelled', 'interrupted'])

function verificationDuration(c: Candidate): number | undefined {
  const timings = ['installing', 'verifying', 'previewing'].flatMap(stage => c.timings[stage as CandidateStage] ? [c.timings[stage as CandidateStage]!] : [])
  return timings.some(t => t.endedAt === undefined) ? undefined : timings.reduce((sum, t) => sum + Math.max(0, t.endedAt! - t.startedAt), 0)
}

export class ChoiceChangedError extends Error {
  constructor() { super('选择已变化，请刷新后再说明理由。'); this.name = 'ChoiceChangedError' }
}

export class Comparer {
  readonly store: RunStore
  private readonly live = new Map<string, LiveRun>()
  private readonly queues = new Map<string, Promise<unknown>>()
  private readonly startReservations = new Set<object>()
  private readonly operations = new Set<Promise<unknown>>()
  private readonly owners = new Map<string, Promise<FileLease>>()
  private readonly ownerUses = new Map<string, number>()
  private readonly adoptionControllers = new Map<string, { controller: AbortController; record: RunRecord }>()
  private readonly lifetime = new AbortController()
  private closing = false
  private disposal?: Promise<void>

  constructor(private readonly opts: ComparerOptions) {
    if (!Number.isSafeInteger(opts.maxActiveRuns ?? 1) || (opts.maxActiveRuns ?? 1) < 1) throw new Error('maxActiveRuns 必须是正整数')
    this.store = opts.store ?? new RunStore()
  }

  /** Validate, snapshot the baseline, bind the acceptance, persist, then work in the background. */
  start(input: StartInput): Promise<RunRecord> {
    return this.operation(() => this.startRun(input))
  }

  private async startRun(input: StartInput): Promise<RunRecord> {
    if (this.opts.prepareProjectProcess === undefined) throw new Error('项目命令没有可用的写入边界；请由宿主提供进程沙箱后开始比较')
    const task = input.task.trim()
    if (task === '') throw new Error('任务描述为空')
    if (input.windowsProcessCompat !== undefined && !['auto', 'off'].includes(input.windowsProcessCompat)) throw new Error('Windows 进程兼容设置无效')
    const active = [...this.live.values()].filter((l) => l.record.state === 'running').length
    if (active + this.startReservations.size >= (this.opts.maxActiveRuns ?? 1)) throw new BusyError('已有一轮比较正在准备或生成，请等它结束或停止后再开始新的一轮')
    const reservation = {}
    this.startReservations.add(reservation)
    try { return await this.prepareStart(input, task, reservation) }
    finally { this.startReservations.delete(reservation) }
  }

  private async prepareStart(input: StartInput, task: string, reservation: object): Promise<RunRecord> {
    // Any directory works: a repository is copied as it is; anything else
    // starts both versions in a private, empty repository of this run.
    const workspace = await resolveWorkspace(input.repo)
    this.assertOpen()
    const runId = newRunId()
    let root: string
    let projectPath: string | undefined
    let target: FolderTarget | undefined
    if (workspace.kind === 'repository') {
      root = workspace.root
      projectPath = workspace.projectPath || undefined
    } else {
      root = await createPrivateWorkspace(this.store.workspace(runId))
      target = { kind: 'folder', ...(workspace.folder ? { folder: workspace.folder } : {}) }
    }
    const info = await inspectProject(projectDirectory(root, projectPath))

    const { mode, routes, strategies } = candidatePlan(input)
    const blind = input.blind !== false

    const scratch = this.store.artifacts(runId)
    await mkdir(scratch, { recursive: true })
    const head = await headCommit(root)
    const tree = await snapshotTree(root, scratch, ALWAYS_EXCLUDED)
    const dirty = head === undefined ? true : tree !== (await treeOf(root, head))
    const acceptance = await buildAcceptance(root, tree, info, input.checks, input.windowsProcessCompat ?? 'auto', projectPath)
    const snapshotCommit = await commitTree(root, tree, [head], `agent-compare baseline ${runId}`)

    // A blind comparison must not let the settings' order reveal who is who.
    const order = strategies.map((_, i) => i)
    if (blind && input.assignment !== 'fixed') {
      for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j]!, order[i]!] }
    }
    const mk = (label: CandidateLabel, i: number): Candidate => ({ label, strategy: strategies[i]!, route: routes[i]!, stage: 'queued', timings: {} })
    const record: RunRecord = {
      schema: RUN_SCHEMA,
      coordination: RUN_COORDINATION,
      producer: { name: 'dsh-agent-compare', version: this.opts.version },
      runId,
      createdAt: Date.now(),
      task,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.follows === undefined ? {} : { follows: input.follows }),
      ...(input.conversationContext === undefined ? {} : { conversationContext: input.conversationContext }),
      ...(input.origin === undefined ? {} : { origin: input.origin }),
      ...(target === undefined ? {} : { target }),
      baseline: { repoRoot: root, headCommit: head, snapshotCommit, snapshotTree: tree, dirty, ...(projectPath ? { projectPath } : {}) },
      acceptance,
      mode,
      ...(blind ? {} : { blind: false as const }),
      isolation: this.opts.runner.isolation,
      budget: { generationMs: input.generationMs ?? this.opts.generationMs ?? DEFAULT_GENERATION_MS },
      state: 'running',
      candidates: order.map((source, i) => mk(CANDIDATE_LABELS[i]!, source)),
      rev: 0,
      updatedAt: Date.now(),
    }
    const lr: LiveRun = { record, hostContext: input.hostContext, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
    this.assertOpen()
    // An identifier collision must not displace a live run or its previews.
    if (this.live.has(runId)) throw new StaleRecordError(runId)
    await this.ensureOwnership(runId, 'start')
    // No await between releasing the reservation and publishing the live slot.
    this.startReservations.delete(reservation)
    this.live.set(runId, lr)
    try {
      this.assertOpen()
      // Creation refuses an existing record before any baseline ref can change.
      await this.persist(record)
      this.assertOpen()
      await pinRef(root, `refs/agent-compare/${runId}/base`, snapshotCommit)
      this.assertOpen()
      lr.done = this.drive(lr).catch(() => {})
      return record
    } catch (error) {
      if (this.live.get(runId) === lr) this.live.delete(runId)
      if (record.rev > 0) {
        record.state = 'interrupted'
        for (const c of record.candidates) {
          c.stage = 'interrupted'
          c.error = { stage: 'preparing', message: `比较未启动：${String((error as Error).message ?? error).slice(0, 1500)}` }
        }
        // Preserve the original error if storage is itself unavailable.
        await this.serial(runId, () => this.store.save(record)).catch(() => {})
      }
      await this.releaseOwnership(runId)
      throw error
    }
  }

  /** Resolve once every candidate has settled (ready, failed or cancelled). */
  async wait(runId: string): Promise<RunRecord | undefined> {
    await this.live.get(runId)?.done
    return this.get(runId)
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    return this.live.get(runId)?.record ?? this.store.load(runId)
  }

  /** Reconcile a current-protocol orphan when opened after its owner exits.
   * A foreign live owner and an unmarked older record remain untouched. */
  async observe(runId: string): Promise<RunRecord | undefined> {
    const r = await this.get(runId)
    if (!r || this.closing) return r
    const pending = this.owners.get(runId)
    if (pending) {
      try { await pending; return this.get(runId) }
      catch (error) { if (error instanceof BusyError) return this.get(runId); throw error }
    }
    if (r.coordination !== RUN_COORDINATION || !needsRecovery(r)) return r
    try { return await this.operation(() => this.get(runId), runId) }
    catch (error) { if (error instanceof BusyError) return this.get(runId); throw error }
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
      record.coordination = RUN_COORDINATION
      await this.store.save(record)
      this.opts.onUpdate?.(record)
    })
  }

  private async drive(lr: LiveRun): Promise<void> {
    const record = lr.record
    const preparation = record.candidates.map(() => {
      let complete!: () => void
      const ready = new Promise<void>(resolve => { complete = resolve })
      return { complete, ready }
    })
    const allPrepared = Promise.all(preparation.map(p => p.ready)).then(() => {})
    const settled = await Promise.allSettled(record.candidates.map(async (c, i) => {
      try { await this.driveCandidate(lr, c, preparation[i]!.complete, allPrepared) }
      catch (error) { lr.controller.abort(error); throw error }
    }))
    if (settled.some(result => result.status === 'rejected')) {
      record.state = 'interrupted'
    } else if (record.state === 'running') {
      record.state = 'judging'
      record.checksFavoured = favoured(record.candidates)
    }
    await this.persist(record)
  }

  private async driveCandidate(lr: LiveRun, c: Candidate, prepared: () => void, allPrepared: Promise<void>): Promise<void> {
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
      // A Vite project's declared manager must be ready before any model call;
      // for other projects a missing manager only means no install later.
      const project = await inspectProject(projectDirectory(dir, record.baseline.projectPath))
      if (project.kind === 'vite' && (project.packageManagerVersion || project.packageManager !== 'npm')) {
        try {
          const version = await runProjectProcess([project.packageManager, '--version'], { cwd: dir, timeoutMs: 30_000, signal, env: { CI: '1' } }, request => prepareProjectProcess({ ...request, windowsProcessCompat: record.acceptance.runtime.windowsProcessCompat ?? 'auto' }, this.opts.prepareProjectProcess))
          signal.throwIfAborted()
          const issue = managerVersionIssue(project, version.code === 0 && !version.truncated ? version.stdout.trim() : undefined)
          if (issue) throw new StageFailure('preparing', issue)
        } catch (error) { if (!signal.aborted) lr.managerFailure = (error as Error).message; throw error }
      }
      prepared()
      // Candidate tools may invoke Git too. Finish both copies' shared Git
      // metadata before either candidate can run a command in its copy.
      await allPrepared
      signal.throwIfAborted()
      if (lr.managerFailure) throw new StageFailure('preparing', lr.managerFailure)

      await enter('generating')
      signal.throwIfAborted()
      const budget = AbortSignal.timeout(record.budget.generationMs)
      let lastSave = 0
      const result = await this.opts.runner.run({
        label: c.label,
        cwd: dir,
        prompt: candidatePrompt(record.task, c.strategy, record.isolation, record.conversationContext?.text,
          record.target ? { kind: 'folder' } : { kind: 'repository', ...(record.baseline.projectPath ? { projectPath: record.baseline.projectPath } : {}), answers: nothingToRun(record) },
          { candidates: record.candidates.length, blind: record.blind !== false }),
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
      if (error instanceof ProcessStopError) {
        c.stopUnconfirmed = true
        c.error = { stage, message: error.message }
      }
      for (const t of Object.values(c.timings)) if (t && t.endedAt === undefined) t.endedAt = Date.now()
      await this.stopPreview(lr, c.label)
      delete c.preview
      await this.persist(record)
    } finally {
      // A failed preparation must not leave the other candidate waiting.
      prepared()
    }
  }

  /** Freeze what the copy holds, then run the full acceptance on it. Ends in `ready` or throws. */
  private async sealAndVerify(lr: LiveRun, c: Candidate, signal: AbortSignal, enter: (s: CandidateStage) => Promise<void>): Promise<void> {
    const record = lr.record
    const repo = record.baseline.repoRoot
    const dir = c.dir!
    await enter('sealing')
    if (!c.ownerToken) throw new StageFailure('sealing', '候选缺少副本归属凭据，拒绝封存')
    const copy = { repo, owner: { runId: record.runId, label: c.label, token: c.ownerToken }, yarnModern: record.acceptance.runtime.yarnModern }
    const change = await captureChange(dir, record.baseline.snapshotCommit, `agent-compare candidate ${record.runId}/${c.label}`, copy)
    // A reply that changed nothing is a result of its own: the task was a
    // greeting or a question. Inside a project that could be built, only a
    // reply the agent finished counts; one cut short may be an unfinished change.
    const answer = change.touched.length === 0 && (c.summary ?? '').trim() !== '' && (nothingToRun(record) || c.generation?.ended === 'completed')
    if (change.touched.length === 0 && !answer) {
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
    if (answer) c.result = 'answer'
    await pinRef(repo, `refs/agent-compare/${record.runId}/${c.label}`, change.commit)
    await this.verifyCandidate(lr, c, signal, enter)
  }

  /** Verify the original sealed candidate again without recapturing or generating code. */
  private async verifyCandidate(lr: LiveRun, c: Candidate, signal: AbortSignal, enter: (s: CandidateStage) => Promise<void>): Promise<void> {
    const record = lr.record, repo = record.baseline.repoRoot, dir = c.dir!
    if (!c.ownerToken || !c.candidateTree) throw new StageFailure('installing', '缺少封存内容或副本归属，不能重新验收')
    const copy = { repo, owner: { runId: record.runId, label: c.label, token: c.ownerToken }, yarnModern: record.acceptance.runtime.yarnModern }
    const artifacts = this.store.artifacts(record.runId)
    const acc = await acceptanceChanges(repo, record.acceptance, record.baseline.snapshotTree, c.candidateTree, record.baseline.projectPath)
    c.acceptanceTouched = acc.touched
    c.dependencyChange = acc.dependencyChange

    const v = await this.verifyCopy(record.acceptance, dir, copy, c.candidateTree, path.join(artifacts, c.label), signal, enter, async evidence => {
      Object.assign(c, evidence)
      await this.persist(record)
    }, { projectPath: record.baseline.projectPath, answerOnly: c.result === 'answer' })
    if (v.preview) lr.previews.set(c.label, v.preview.handle)
    if (v.install) c.install = v.install
    if (v.execution) c.execution = v.execution
    if (v.result) c.result = v.result
    else delete c.result
    if (v.previewNote) c.previewNote = v.previewNote
    else delete c.previewNote
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

  /** Explicit environment retry: same sealed bytes, original acceptance and no generation calls. */
  retryVerification(runId: string, label: CandidateLabel): Promise<RunRecord> {
    return this.operation(() => this.serial(runId, () => this.retryRunVerification(runId, label)), runId)
  }

  private async retryRunVerification(runId: string, label: CandidateLabel): Promise<RunRecord> {
    const current = await this.fresh(runId), previous = current.candidates.find(c => c.label === label)
    if (previous?.install?.failure?.kind === 'lockfile') throw new Error('封存的依赖声明与锁文件不一致；请修正后开始新的比较，当前候选与记录仍保留')
    if (!previous || !canRetryVerification(current, previous)) throw new Error('现在不能重新验收：需要保留完整封存内容的失败、中断或已停止候选，且尚未选择或清理')
    const active = [...this.live.values()].filter(lr => lr.record.state === 'running').length
    if (active + this.startReservations.size >= (this.opts.maxActiveRuns ?? 1)) throw new BusyError('已有比较正在运行，请等它结束或停止后再重新验收')
    const reservation = {}
    this.startReservations.add(reservation)
    try {
      const copy = { repo: current.baseline.repoRoot, owner: { runId, label, token: previous.ownerToken! }, yarnModern: current.acceptance.runtime.yarnModern }
      if ((await ownedCopyTree(previous.dir!, copy, previous.candidateTree)) !== previous.candidateTree) throw new Error('候选副本已变化，不能用原封存内容重新验收；已保留现有文件与补丁')
      if ((await treeOf(current.baseline.repoRoot, previous.candidateCommit!)) !== previous.candidateTree
        || (await readPatchSha(previous.patchFile!)) !== previous.patchSha256) throw new Error('封存提交或补丁与记录不一致，已停止重新验收')
      this.assertOpen()
      const record = structuredClone(current), c = record.candidates.find(c => c.label === label)!
      const durationMs = verificationDuration(c)
      ;(c.verificationHistory ??= []).push({ recordedAt: Date.now(), ...(durationMs === undefined ? {} : { durationMs }), ...(c.install ? { install: c.install } : {}), ...(c.checks ? { checks: c.checks } : {}), ...(c.error ? { error: c.error } : {}) })
      for (const stage of ['installing', 'verifying', 'previewing', 'ready'] as const) delete c.timings[stage]
      delete c.install; delete c.checks; delete c.checkedTree; delete c.drift; delete c.preview
      delete c.screenshot; delete c.mobileScreenshot; delete c.verdict; delete c.execution; delete c.error; delete c.previewNote
      // An answer stays an answer; a files result is decided again by the new attempt.
      if (c.result !== 'answer') delete c.result
      c.stage = 'installing'; c.timings.installing = { startedAt: Date.now() }
      record.state = 'running'; delete record.checksFavoured
      // Publish the new record atomically before replacing the live view. A
      // failed initial save leaves the previous result and attempts intact.
      await this.store.save(record)
      const old = this.live.get(runId), ctl = new AbortController()
      const lr: LiveRun = { record, hostContext: old?.hostContext, controller: new AbortController(), perCandidate: new Map([[label, ctl]]), previews: old?.previews ?? new Map(), done: Promise.resolve() }
      const signal = AbortSignal.any([this.lifetime.signal, lr.controller.signal, ctl.signal])
      this.live.set(runId, lr)
      const enter = async (stage: CandidateStage): Promise<void> => {
        if (c.stage === stage) { await this.persist(record); return }
        const prior = c.timings[c.stage]
        if (prior && prior.endedAt === undefined) prior.endedAt = Date.now()
        c.stage = stage; c.timings[stage] = { startedAt: Date.now() }
        await this.persist(record)
      }
      lr.done = Promise.resolve().then(async () => {
        try { await this.verifyCandidate(lr, c, signal, enter) }
        catch (error) {
          const stage = error instanceof StageFailure ? error.stage : c.stage === 'stopping'
            ? (Object.entries(c.timings).find(([, timing]) => timing?.endedAt === undefined)?.[0] as CandidateStage | undefined) ?? 'installing' : c.stage
          c.stage = signal.aborted ? 'cancelled' : 'failed'
          c.error = { stage, message: signal.aborted && !(error instanceof ProcessStopError) ? '重新验收已停止；封存内容仍保留' : String((error as Error).message ?? error).slice(0, 2000) }
          if (error instanceof ProcessStopError) c.stopUnconfirmed = true
          for (const timing of Object.values(c.timings)) if (timing && timing.endedAt === undefined) timing.endedAt = Date.now()
          await this.stopPreview(lr, label)
          delete c.preview
        } finally {
          record.state = 'judging'; record.checksFavoured = favoured(record.candidates)
          await this.persist(record)
        }
      }).catch(() => {})
      return record
    } finally { this.startReservations.delete(reservation) }
  }

  /**
   * Seal and verify what a candidate had written when it failed during
   * generation (stopped by the budget, an earlier version, or a host
   * restart). Its copy must still be the one this run created.
   */
  salvage(runId: string, label: CandidateLabel): Promise<RunRecord> {
    return this.operation(() => this.salvageRun(runId, label), runId)
  }

  private async salvageRun(runId: string, label: CandidateLabel): Promise<RunRecord> {
    if (this.live.get(runId)?.record.state === 'running') throw new BusyError('这次比较还在进行中')
    const r = await this.mustLoad(runId)
    if (r.state !== 'judging' && r.state !== 'interrupted') throw new Error(`现在不能验收（${r.state}）`)
    const c = r.candidates.find((x) => x.label === label)
    if (c === undefined || c.stopUnconfirmed || (c.stage !== 'failed' && c.stage !== 'interrupted') || (c.error?.stage !== 'generating' && c.error?.stage !== 'sealing')) throw new Error('只有在生成阶段中止且已停止的候选可以验收已写的改动')
    if (c.dir === undefined || c.ownerToken === undefined || !existsSync(c.dir)) throw new Error('这个候选的副本已经不在了')
    const lr: LiveRun = this.live.get(runId) ?? { record: r, hostContext: undefined, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
    this.live.set(runId, lr)
    const record = lr.record
    const cand = record.candidates.find((x) => x.label === label)!
    const ctl = new AbortController()
    lr.perCandidate.set(label, ctl)
    const signal = AbortSignal.any([this.lifetime.signal, lr.controller.signal, ctl.signal])
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
        const failedStage = cand.stage
        cand.stage = signal.aborted ? 'cancelled' : 'failed'
        if (!signal.aborted) cand.error = { stage: error instanceof StageFailure ? error.stage : failedStage, message: String((error as Error).message ?? error).slice(0, 2000) }
        if (error instanceof ProcessStopError) {
          cand.stopUnconfirmed = true
          cand.error = { stage: failedStage, message: error.message }
        }
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
   * Verify the copy `dir`, whose files must equal `sealedTree`, and serve it.
   * Used for each candidate and for the adoption rehearsal.
   *
   * What runs follows the project in the copy (see `profileProject`): a Vite
   * project installs, runs the shared commands and serves its build; another
   * Node project installs and runs them, and serves its `dev`/`start` script;
   * an HTML page is served as files; anything else has no live page. A result
   * without a live page is judged by its files, or by the answer alone.
   */
  private async verifyCopy(acceptance: Acceptance, dir: string, copy: OwnedCopy, sealedTree: string, shotBase: string, signal: AbortSignal, enter?: (s: CandidateStage) => Promise<void>, onEvidence?: (facts: Partial<Pick<Candidate, 'install' | 'checks' | 'execution'>>) => Promise<void>, scope: { projectPath?: string; answerOnly?: boolean } = {}): Promise<{
    install?: NonNullable<Candidate['install']>
    execution?: NonNullable<Candidate['execution']>
    checks: CheckResult[]
    checkedTree: string
    drift: string[]
    preview?: { info: PreviewInfo; handle: Preview }
    screenshot?: string
    mobileScreenshot?: string
    result?: 'answer' | 'files'
    previewNote?: string
  }> {
    await enter?.('installing')
    const checkedTree = await ownedCopyTree(dir, copy, sealedTree)
    if (checkedTree !== sealedTree) throw new StageFailure('installing', '副本内容与封存的版本不一致，拒绝验收')
    // Let Git exclude untracked output while retaining tracked source, even
    // inside ignored folders. The baseline .gitignore is bound acceptance;
    // folder names alone never justify skipping source changes.
    const driftOf = async (): Promise<string[]> => changedPaths(copy.repo, sealedTree, await ownedCopyTree(dir, copy, sealedTree))
    // A reply without files has nothing to install, check or serve.
    if (scope.answerOnly) return { checks: [], checkedTree, drift: await driftOf(), result: 'answer' }
    const projectDir = projectDirectory(dir, scope.projectPath)
    const project = await profileProject(projectDir)
    const usable = project.info.kind === 'vite' || project.info.node === true
    const sharedCommands = acceptance.checks.commands.length > 0
    // Installing serves the shared commands, or a server the project needs to show itself.
    if (!usable || !(sharedCommands || project.profile === 'vite' || project.profile === 'node-web')) {
      return this.serveFiles(acceptance, projectDir, dir, project, shotBase, signal, driftOf, checkedTree, enter, project.note)
    }
    return this.verifyNodeCopy(acceptance, dir, projectDir, copy, project, shotBase, signal, driftOf, checkedTree, enter, onEvidence)
  }

  /** No installation: serve an HTML page as files when there is one, otherwise keep the files as the result. */
  private async serveFiles(acceptance: Acceptance, projectDir: string, dir: string, project: ProfiledProject, shotBase: string, signal: AbortSignal, driftOf: () => Promise<string[]>, checkedTree: string, enter?: (s: CandidateStage) => Promise<void>, note?: string): Promise<{ checks: CheckResult[]; checkedTree: string; drift: string[]; preview?: { info: PreviewInfo; handle: Preview }; screenshot?: string; mobileScreenshot?: string; result?: 'files'; previewNote?: string }> {
    const entry = project.entry ?? await staticEntry(projectDir)
    if (entry === undefined) {
      return { checks: [], checkedTree, drift: await driftOf(), result: 'files', ...(note ? { previewNote: note } : {}) }
    }
    await enter?.('previewing')
    let handle: Preview
    try { handle = await startStaticPreview(projectDir, entry, { timeoutMs: this.opts.previewTimeoutMs ?? 60_000, signal }) }
    catch (error) {
      if (signal.aborted) throw error
      return { checks: [], checkedTree, drift: await driftOf(), result: 'files', previewNote: `页面服务没有启动：${(error as Error).message}` }
    }
    const preview = { handle, info: { url: handle.url, port: handle.port, pid: handle.pid, kind: 'static' as const, cwd: projectDir } }
    return this.finishPreview(acceptance, [], preview, shotBase, signal, driftOf, checkedTree, note)
  }

  /** Install, run the shared commands, then serve: Vite's build, or the project's server script. */
  private async verifyNodeCopy(acceptance: Acceptance, dir: string, projectDir: string, copy: OwnedCopy, project: ProfiledProject, shotBase: string, signal: AbortSignal, driftOf: () => Promise<string[]>, checkedTree: string, enter?: (s: CandidateStage) => Promise<void>, onEvidence?: (facts: Partial<Pick<Candidate, 'install' | 'checks' | 'execution'>>) => Promise<void>): Promise<{
    install?: NonNullable<Candidate['install']>
    execution?: NonNullable<Candidate['execution']>
    checks: CheckResult[]
    checkedTree: string
    drift: string[]
    preview?: { info: PreviewInfo; handle: Preview }
    screenshot?: string
    mobileScreenshot?: string
    result?: 'files'
    previewNote?: string
  }> {
    const info = project.info
    // With shared commands (or for Vite) an install problem fails the candidate,
    // as it always has. Otherwise it only means there is no live server.
    const strict = project.profile === 'vite' || acceptance.checks.commands.length > 0
    // An install without a lockfile writes one; that file is install output, not a change to the result.
    const inProject = path.relative(dir, projectDir).split(path.sep).filter(Boolean).join('/')
    const written = info.lockfile === undefined ? new Set(LOCKFILES.map(file => inProject ? `${inProject}/${file}` : file)) : new Set<string>()
    const sealedDriftOf = driftOf
    driftOf = async () => (await sealedDriftOf()).filter(file => !written.has(file))
    const degrade = async (note: string) => this.serveFiles(acceptance, projectDir, dir, project, shotBase, signal, driftOf, checkedTree, enter, note)
    let enforcement: 'full' | 'partial' | 'unknown' = 'full'
    const compatibility = new WindowsCompatObserver()
    const prepare: PrepareProjectProcess = async request => {
      const prepared = await prepareProjectProcess({ ...request, windowsProcessCompat: acceptance.runtime.windowsProcessCompat ?? 'auto' }, this.opts.prepareProjectProcess)
      const observe = compatibility.prepare(prepared.windowsProcessCompat)
      if (prepared.enforcement === undefined) enforcement = 'unknown'
      else if (prepared.enforcement === 'partial' && enforcement !== 'unknown') enforcement = 'partial'
      await onEvidence?.({ execution: { enforcement } })
      return { ...prepared, observeStderr: chunk => { prepared.observeStderr?.(chunk); observe(chunk) } }
    }
    if (copy.yarnModern) {
      // Remove only fixed project-level files in an ownership-checked copy. A
      // model-written loader must not survive a frozen dependency install.
      await ownedWorktreeAdmin(copy.repo, dir, copy.owner)
      for (const file of YARN_RUNTIME_FILES) await rm(path.join(projectDir, file), { force: true })
    }
    const inst = installArgv(info)
    const observed = await runProjectProcess([inst.argv[0]!, '--version'], { cwd: projectDir, timeoutMs: 10_000, signal, env: { CI: '1' } }, prepare).catch(error => {
      if (error instanceof ProcessStopError) throw error
      return undefined
    })
    signal.throwIfAborted()
    const reportedVersion = observed?.stdout.trim()
    const packageManagerVersion = observed?.code === 0 && !observed.truncated && reportedVersion && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(reportedVersion) ? reportedVersion : undefined
    if (info.packageManagerVersion || info.packageManager !== 'npm') {
      const issue = managerVersionIssue(info, packageManagerVersion)
      if (issue) {
        const message = issue.replace('；未请求模型。', '；未开始本次依赖安装。')
        if (strict) throw new StageFailure('installing', message)
        return degrade(message)
      }
    }
    const runtime = { hostNode: process.version, platform: `${process.platform}-${process.arch}`, packageManager: inst.argv[0]!, ...(packageManagerVersion ? { packageManagerVersion } : {}) }
    const t0 = Date.now()
    const r = await runProjectProcess(inst.argv, { cwd: projectDir, timeoutMs: 600_000, signal, env: { CI: '1' } }, prepare)
    const failure = r.code !== 0 || r.aborted || r.timedOut ? installFailure(r) : undefined
    const install: NonNullable<Candidate['install']> = { argv: inst.argv, frozen: inst.frozen, durationMs: Date.now() - t0, outcome: r.timedOut ? 'timeout' : r.aborted ? 'cancelled' : r.code === 0 ? 'passed' : 'failed', runtime, ...(failure ? { failure } : {}) }
    const currentInstall = (): NonNullable<Candidate['install']> => ({ ...install, runtime: { ...runtime, windowsProcessCompat: compatibility.snapshot() } })
    await onEvidence?.({ install: currentInstall() })
    signal.throwIfAborted()
    if (r.code !== 0 || r.timedOut) {
      const reason = failure!
      const message = `${reason.summary}。${reason.hint}${inst.frozen ? `\n仍使用锁文件 ${info.lockfile} 冻结安装，不改用非冻结安装。` : ''}${reason.diagnostic ? `\n${reason.diagnostic}` : ''}`
      if (strict) throw new StageFailure('installing', message)
      return { ...await degrade(`依赖安装失败，没有启动项目服务：${reason.summary}`), install: currentInstall(), execution: { enforcement } }
    }

    await enter?.('verifying')
    const checks = await runCommandChecks(projectDir, acceptance.checks, signal, prepare)
    await onEvidence?.({ checks, install: currentInstall() })
    signal.throwIfAborted()
    const buildOk = checks.find((k) => k.name === 'build')?.outcome === 'passed'

    await enter?.('previewing')
    let preview: { info: PreviewInfo; handle: Preview } | undefined
    let previewNote: string | undefined
    const timeoutMs = this.opts.previewTimeoutMs ?? 60_000
    if (project.profile === 'vite') {
      try {
        const kind = buildOk ? 'build' : 'dev'
        const handle = await startVitePreview(projectDir, { kind, timeoutMs, signal, prepareProjectProcess: prepare })
        preview = { handle, info: { url: handle.url, port: handle.port, pid: handle.pid, kind, cwd: projectDir, ...(handle.launcher ? { launcher: handle.launcher } : {}) } }
      } catch (error) {
        if (error instanceof ProcessStopError) throw error
        if (signal.aborted) throw error
        await onEvidence?.({ install: currentInstall() })
        const log = error instanceof PreviewError ? `\n${diagnosticText(error.log, 1500)}` : ''
        throw new StageFailure('previewing', `${(error as Error).message}${log}`)
      }
    } else if (project.profile === 'node-web') {
      try {
        const handle = await startScriptPreview(projectDir, scriptArgv(info, project.script!), { timeoutMs, signal, prepareProjectProcess: prepare })
        preview = { handle, info: { url: handle.url, port: handle.port, pid: handle.pid, kind: 'script', cwd: projectDir } }
      } catch (error) {
        if (error instanceof ProcessStopError) throw error
        if (signal.aborted) throw error
        // A script that is not a web server on PORT is not a failed candidate.
        previewNote = `项目的 ${project.script} 脚本没有在预览端口提供页面：${(error as Error).message}`
      }
    }
    if (preview === undefined) {
      const served = await this.serveFiles(acceptance, projectDir, dir, project, shotBase, signal, driftOf, checkedTree, undefined, previewNote ?? project.note)
      return { ...served, checks: [...checks, ...served.checks], install: currentInstall(), execution: { enforcement } }
    }
    const finished = await this.finishPreview(acceptance, checks, preview, shotBase, signal, driftOf, checkedTree, previewNote)
    return { ...finished, install: currentInstall(), execution: { enforcement } }
  }

  /** Run the page acceptance on a live preview; the preview stops if anything after it fails. */
  private async finishPreview(acceptance: Acceptance, checks: CheckResult[], preview: { info: PreviewInfo; handle: Preview }, shotBase: string, signal: AbortSignal, driftOf: () => Promise<string[]>, checkedTree: string, previewNote?: string): Promise<{ checks: CheckResult[]; checkedTree: string; drift: string[]; preview: { info: PreviewInfo; handle: Preview }; screenshot?: string; mobileScreenshot?: string; previewNote?: string }> {
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
      const drift = await driftOf()
      return { checks, checkedTree, drift, preview, ...(screenshot ? { screenshot } : {}), ...(mobileScreenshot ? { mobileScreenshot } : {}), ...(previewNote ? { previewNote } : {}) }
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
  cancel(runId: string, label?: CandidateLabel): Promise<RunRecord | undefined> {
    return this.operation(() => this.cancelRun(runId, label), runId)
  }

  private async cancelRun(runId: string, label?: CandidateLabel): Promise<RunRecord | undefined> {
    const lr = this.live.get(runId)
    if (lr === undefined) return this.get(runId)
    for (const c of lr.record.candidates) {
      if ((label === undefined || c.label === label) && !SETTLED.has(c.stage)) c.stage = 'stopping'
    }
    if (label === undefined) lr.controller.abort()
    else lr.perCandidate.get(label)?.abort()
    await this.persist(lr.record)
    return lr.record
  }

  /**
   * Record the blind choice and reveal at once. Any finished candidate can be
   * picked; adoption rules come later. After the reveal the user may change the
   * pick to another finished candidate while nothing is adopted: the first,
   * blind pick stays recorded as `initialPick`.
   */
  choose(runId: string, pick: CandidateLabel | 'none', note?: string): Promise<RunRecord> {
    return this.operation(() => this.mutate(runId, (r) => {
      const revising = r.state === 'revealed' && r.choice !== undefined
      if (revising) {
        if (pick === 'none' || pick === r.choice!.pick) throw new Error(pick === 'none' ? '揭晓后只能改选另一版已完成的结果' : '已经选了这一版')
        // An adoption attempt owns journals, retained originals and rehearsal
        // copies that belong to its pick; keep them bound to that pick.
        if (r.adoption !== undefined) throw new Error('这次比较已有采用记录，不能改选')
      } else if (r.state !== 'judging' && !(r.state === 'interrupted' && pick === 'none')) throw new Error(`现在不能选择（${r.state}）`)
      if (pick !== 'none' && r.candidates.find((c) => c.label === pick)?.stage !== 'ready') throw new Error(`候选 ${pick} 还没有可体验的结果`)
      const initialPick = revising ? r.choice!.initialPick ?? r.choice!.pick : undefined
      r.choice = { pick, at: Date.now(), ...(note === undefined ? {} : { note }), ...(initialPick === undefined ? {} : { initialPick }) }
      r.state = 'revealed'
      r.revealedAt ??= Date.now()
    }), runId)
  }

  /**
   * Say why the picked version won: fixed reasons and an optional short note.
   * It changes nothing else, may follow the adoption, and an empty answer
   * clears it. A pick changed later starts without reasons.
   */
  explainChoice(runId: string, reasons: readonly PickReason[], note?: string, expectedPick?: CandidateLabel): Promise<RunRecord> {
    return this.operation(() => this.mutate(runId, (r) => {
      if (r.choice === undefined || r.choice.pick === 'none') throw new Error('先选出一版，再说明理由')
      if (expectedPick !== undefined && r.choice.pick !== expectedPick) throw new ChoiceChangedError()
      const unique = PICK_REASONS.filter(reason => reasons.includes(reason))
      const text = (note ?? '').replace(/\s+/g, ' ').trim()
      if ([...text].length > MAX_PICK_NOTE) throw new Error(`理由补充不能超过 ${MAX_PICK_NOTE} 个字`)
      const { reasons: _reasons, note: _note, ...rest } = r.choice
      r.choice = { ...rest, ...(unique.length ? { reasons: unique } : {}), ...(text ? { note: text } : {}) }
    }), runId)
  }

  /**
   * Serve a finished candidate again (its preview stopped with a host
   * restart, or was never started). Uses the copy's existing build output
   * when there is one; the copy must still be the one this run created.
   */
  reopenPreview(runId: string, label: CandidateLabel): Promise<RunRecord> {
    return this.operation(() => this.reopenRunPreview(runId, label), runId)
  }

  private async reopenRunPreview(runId: string, label: CandidateLabel): Promise<RunRecord> {
    const r = await this.mustLoad(runId)
    return this.serial(runId, async () => {
      const lr: LiveRun = this.live.get(runId) ?? { record: r, hostContext: undefined, controller: new AbortController(), perCandidate: new Map(), previews: new Map(), done: Promise.resolve() }
      this.live.set(runId, lr)
      const c = lr.record.candidates.find((x) => x.label === label)
      if (c === undefined || c.stage !== 'ready') throw new Error('只有已完成验收的候选可以重新打开预览')
      if (lr.previews.has(label) && c.preview !== undefined) return lr.record
      if (c.dir === undefined || !existsSync(c.dir)) throw new Error('这个候选的副本已经清理，只能查看截图')
      if (!c.ownerToken) throw new Error('候选缺少副本归属凭据，拒绝重新打开预览')
      await ownedWorktreeAdmin(r.baseline.repoRoot, c.dir, { runId: r.runId, label: c.label, token: c.ownerToken })
      if (c.result !== undefined) throw new Error('这个结果没有可打开的页面')
      const projectDir = projectDirectory(c.dir, r.baseline.projectPath)
      const project = await profileProject(projectDir)
      const timeoutMs = this.opts.previewTimeoutMs ?? 60_000
      const prepare: PrepareProjectProcess = request => prepareProjectProcess({ ...request, windowsProcessCompat: lr.record.acceptance.runtime.windowsProcessCompat ?? 'auto' }, this.opts.prepareProjectProcess)
      let handle: Preview
      let kind: PreviewInfo['kind']
      if (project.profile === 'vite') {
        kind = c.checks?.find((k) => k.name === 'build')?.outcome === 'passed' && existsSync(path.join(projectDir, 'dist')) ? 'build' : 'dev'
        handle = await startVitePreview(projectDir, { kind, timeoutMs, signal: this.lifetime.signal, prepareProjectProcess: prepare })
      } else if (project.profile === 'node-web' && existsSync(path.join(projectDir, 'node_modules'))) {
        kind = 'script'
        handle = await startScriptPreview(projectDir, scriptArgv(project.info, project.script!), { timeoutMs, signal: this.lifetime.signal, prepareProjectProcess: prepare })
      } else {
        const entry = project.entry ?? await staticEntry(projectDir)
        if (entry === undefined) throw new Error('这个结果没有可打开的页面')
        kind = 'static'
        handle = await startStaticPreview(projectDir, entry, { timeoutMs, signal: this.lifetime.signal })
      }
      lr.previews.set(label, handle)
      c.preview = { url: handle.url, port: handle.port, pid: handle.pid, kind, cwd: projectDir, ...(handle.launcher ? { launcher: handle.launcher } : {}) }
      await this.save(lr.record)
      return lr.record
    })
  }

  /**
   * One file of a candidate's sealed result: its text (first 64 KB), or only
   * its size when it is binary or larger than 4 MB. Deleted paths say so.
   */
  async readResultFile(runId: string, label: CandidateLabel, file: string): Promise<{ path: string; size: number; binary: boolean; deleted?: true; text?: string; truncated: boolean }> {
    const r = await this.mustLoad(runId)
    const c = r.candidates.find((x) => x.label === label)
    if (c?.candidateTree === undefined || !(c.touchedFiles ?? []).includes(file)) throw new Error('这一版没有写这个文件')
    const spec = `${c.candidateTree}:${file}`
    const size = Number((await gitTry(r.baseline.repoRoot, ['cat-file', '-s', spec]))?.trim())
    if (!Number.isSafeInteger(size)) return { path: file, size: 0, binary: false, deleted: true, truncated: false }
    if (size > 4 * 1024 * 1024) return { path: file, size, binary: false, truncated: true }
    const content = await git(r.baseline.repoRoot, ['cat-file', 'blob', spec])
    // NUL bytes or many undecodable sequences: not text worth showing.
    const binary = content.includes('\u0000') || (content.match(/�/g)?.length ?? 0) > Math.max(8, content.length / 100)
    return { path: file, size, binary, ...(binary ? {} : { text: content.slice(0, 65_536) }), truncated: !binary && content.length > 65_536 }
  }

  /** Report-only adoption check: overlap, eligibility and whether a rehearsal will run. Writes nothing. */
  adoptPreflight(runId: string): Promise<{ ok: boolean; eligible: boolean; reasons: string[]; overlapping?: string[]; targetChanged?: boolean; rehearsal?: boolean }> {
    return this.operation(() => this.preflightAdoption(runId), runId)
  }

  private async preflightAdoption(runId: string): Promise<{ ok: boolean; eligible: boolean; reasons: string[]; overlapping?: string[]; targetChanged?: boolean; rehearsal?: boolean }> {
    const r = await this.mustLoad(runId)
    const c = r.candidates.find((x) => x.label === r.choice?.pick)
    if (!c?.candidateCommit) return { ok: false, eligible: false, reasons: ['没有选中的候选'] }
    if (r.target !== undefined) return { ok: false, eligible: c.verdict?.eligible === true, reasons: ['这次比较从非 Git 目录开始，请用「保存到当前目录」把选中的版本存成新文件夹'] }
    if (c.result === 'answer') return { ok: false, eligible: false, reasons: ['这一版只有回答，没有可以写入的文件；回答已写入主对话'] }
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
  adopt(runId: string, mode: 'worktree' | 'branch' | 'folder' = 'worktree'): Promise<RunRecord> {
    if (mode === 'folder') return this.operation(() => this.exportPick(runId), runId)
    const controller = new AbortController()
    return this.operation(() => this.adoptRun(runId, mode, controller), runId).finally(() => {
      if (this.adoptionControllers.get(runId)?.controller === controller) this.adoptionControllers.delete(runId)
    })
  }

  /** Interrupt only this owner's rehearsal; file handoff must finish once writing begins. */
  async cancelAdoption(runId: string): Promise<RunRecord> {
    this.assertOpen()
    const pending = this.adoptionControllers.get(runId)
    if (!pending || pending.record.state !== 'adopting' || pending.record.adoption?.state !== 'rehearsing') {
      throw new AdoptError('state', '当前没有可停止的采用预演；文件交接开始后必须等待核验完成。')
    }
    pending.controller.abort(new Error('已停止采用预演'))
    return pending.record
  }

  private async adoptRun(runId: string, mode: 'worktree' | 'branch', controller: AbortController): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    if (first.target !== undefined) throw new AdoptError('state', '这次比较从非 Git 目录开始，请用「保存到当前目录」把选中的版本存成新文件夹')
    return withRepositoryWrite(first.baseline.repoRoot, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      if (r.state !== 'revealed') throw new AdoptError('state', `现在不能采用（${r.state}）`)
      const pick = r.choice?.pick
      if (pick === undefined || pick === 'none') throw new AdoptError('state', '没有选中的候选')
      const c = r.candidates.find((x) => x.label === pick)!
      if (c.stage !== 'ready' || c.candidateCommit === undefined || c.candidateTree === undefined || c.patchFile === undefined || c.patchSha256 === undefined) throw new AdoptError('state', '这个候选没有可采用的结果')
      if (c.result === 'answer') throw new AdoptError('state', '这一版只有回答，没有可以写入的文件；回答已写入主对话')
      if (!existsSync(c.patchFile) || (await readPatchSha(c.patchFile)) !== c.patchSha256) throw new AdoptError('integrity', '记录的补丁和验收时的不一致')
      if ((await treeOf(r.baseline.repoRoot, c.candidateCommit)) !== c.candidateTree) throw new AdoptError('integrity', '候选提交和封存的内容不一致')
      const repo = r.baseline.repoRoot
      const scratch = this.store.artifacts(runId)
      const nameStatus = await nameStatusOf(repo, r.baseline.snapshotCommit, c.candidateCommit)
      const touched = nameStatus.map((n) => n.path)

      if (mode === 'branch') {
        this.assertOpen()
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
      if (r.adoption?.rehearsal?.stopUnconfirmed) throw new AdoptError('state', '先前预演的进程停止状态未知，副本仍保留；请先检查该任务进程')
      this.adoptionControllers.set(runId, { controller, record: r })
      const signal = AbortSignal.any([this.lifetime.signal, controller.signal])
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

      let pf: Awaited<ReturnType<typeof preflight>>
      try { pf = await preflight({ baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: scratch }) }
      catch (error) { return blocked(`无法完成采用检查：${(error as Error).message}。`) }
      if (signal.aborted) return blocked(this.closing ? '宿主正在停止，已取消采用。' : '已停止采用预演，候选成果仍保留。')
      if (!pf.ok) return blocked(`基线之后你改过这些文件，和这一版的改动重叠：${pf.overlapping.slice(0, 10).join('、')}。`, pf.overlapping)

      if (pf.expectedTree === c.candidateTree) {
        r.adoption.rehearsal = { reused: true, tree: pf.expectedTree }
      } else {
        const rehearsal = await this.rehearse(r, pf.expectedTree, pf.target.head, signal)
        r.adoption.rehearsal = rehearsal.record
        if (signal.aborted) return blocked(rehearsal.record.stopUnconfirmed
          ? '已收到停止预演请求，但进程退出尚未确认；预演副本继续保留，请检查任务进程。'
          : this.closing ? '宿主正在停止，已取消采用。' : '已停止采用预演，候选成果仍保留。')
        if (!rehearsal.ok) return blocked(`把这一版接到你当前的项目上预演后，验收没有通过：${rehearsal.reasons.join('；')}。`)
      }

      const changed = await targetChanges(repo, scratch, pf.target)
      if (changed.length > 0) return blocked(`预演期间项目发生了变化，请检查后重新采用：${changed.slice(0, 10).join('、')}。`, changed)

      // Journal: everything needed to undo is durable before the first byte changes.
      const preAdopt = await pinPreAdopt(repo, pf.target)
      await pinRef(repo, `refs/agent-compare/${runId}/pre-adopt`, preAdopt)
      if (signal.aborted) return blocked(this.closing ? '宿主正在停止，已取消采用。' : '已停止采用预演，候选成果仍保留。')
      this.adoptionControllers.delete(runId)
      Object.assign(r.adoption, { state: 'writing', preAdoptCommit: preAdopt, expectedTree: pf.expectedTree, headBefore: pf.target.head, stagedBefore: pf.target.staged, writtenPaths: [], fileTransfer: newFileTransferRef(), transferDirection: 'apply' })
      await this.save(r)

      let problem: string | undefined
      let attempted: string[] = []
      let completed = false
      try {
        attempted = await writeCandidate(repo, c.candidateCommit, nameStatus, {
          expected: pf.target,
          scratchDir: scratch,
          transfer: r.adoption.fileTransfer!,
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
            r.adoption.message = `已写入 ${touched.length} 个文件，项目现在与${r.adoption.rehearsal?.reused ? '验收过的版本' : '预演通过的版本'}完全一致；未提交，index 和 HEAD 未改动。采用前的原始文件已保留，可从记录撤销`
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
      const undo = await undoAdoption(repo, scratch, { preAdoptCommit: preAdopt, candidateCommit: c.candidateCommit, touched: attempted, ...(r.adoption.fileTransfer ? { transfer: r.adoption.fileTransfer } : {}) })
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
  private async rehearse(r: RunRecord, tree: string, head: string | undefined, signal: AbortSignal): Promise<{ ok: boolean; reasons: string[]; record: NonNullable<NonNullable<RunRecord['adoption']>['rehearsal']> }> {
    const repo = r.baseline.repoRoot
    const dir = path.join(this.store.copies(r.runId), 'R')
    const token = randomBytes(12).toString('hex')
    const record: NonNullable<NonNullable<RunRecord['adoption']>['rehearsal']> = { reused: false, tree, dir, ownerToken: token }
    r.adoption!.rehearsal = record
    await this.save(r)
    let pinned = false, created = false
    try {
      signal.throwIfAborted()
      const commit = await commitTree(repo, tree, [head], `agent-compare rehearsal ${r.runId}`)
      await pinRef(repo, `refs/agent-compare/${r.runId}/rehearsal`, commit)
      pinned = true
      await addOwnedWorktree(repo, dir, commit, { runId: r.runId, label: 'R', token })
      created = true
      const v = await this.verifyCopy(r.acceptance, dir, { repo, owner: { runId: r.runId, label: 'R', token }, yarnModern: r.acceptance.runtime.yarnModern }, tree, path.join(this.store.artifacts(r.runId), 'R'), signal, undefined, undefined, { projectPath: r.baseline.projectPath })
      await v.preview?.handle.stop()
      const reasons = [
        ...v.checks.filter((k) => k.outcome === 'failed' || k.outcome === 'timeout').map((k) => `${k.name} 未通过${k.reason ? `（${k.reason.slice(0, 120)}）` : ''}`),
        ...(v.drift.length > 0 ? [`验收过程中多出了文件：${v.drift.slice(0, 5).join('、')}`] : []),
      ]
      return { ok: reasons.length === 0, reasons, record: { ...record, checks: v.checks } }
    } catch (error) {
      if (error instanceof ProcessStopError) record.stopUnconfirmed = true
      return { ok: false, reasons: [(error as Error).message.split('\n')[0] ?? '预演失败'], record }
    } finally {
      if (!record.stopUnconfirmed) {
        if (created) await removeOwnedWorktree(repo, dir, { runId: r.runId, label: 'R', token })
        if (pinned && (created || !existsSync(dir))) await dropRefs(repo, `refs/agent-compare/${r.runId}/rehearsal`)
      }
    }
  }

  /**
   * Save the picked version of a folder comparison into a new subfolder of
   * that folder. Existing files are never replaced: the subfolder is new, and
   * its name gets a number when the first choice already exists.
   */
  private async exportPick(runId: string): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return withRepositoryWrite(first.baseline.repoRoot, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      if (r.state !== 'revealed') throw new AdoptError('state', `现在不能保存（${r.state}）`)
      if (r.target === undefined) throw new AdoptError('state', '只有从非 Git 目录开始的比较可以保存到文件夹')
      if (r.target.folder === undefined) throw new AdoptError('state', '这次比较没有关联的目录；可以在卡片里查看文件内容')
      const pick = r.choice?.pick
      if (pick === undefined || pick === 'none') throw new AdoptError('state', '没有选中的候选')
      const c = r.candidates.find((x) => x.label === pick)!
      if (c.stage !== 'ready' || c.candidateCommit === undefined || c.candidateTree === undefined) throw new AdoptError('state', '这个候选没有可保存的结果')
      if (c.result === 'answer') throw new AdoptError('state', '这一版只有回答，没有文件；回答已写入主对话')
      const repo = r.baseline.repoRoot
      if ((await treeOf(repo, c.candidateCommit)) !== c.candidateTree) throw new AdoptError('integrity', '候选提交和封存的内容不一致')
      if (!existsSync(r.target.folder)) throw new AdoptError('state', `目标目录不存在：${r.target.folder}`)
      const target = freeFolder(r.target.folder, exportFolderName(r.task, r.runId))
      const startedAt = Date.now()
      const saved = await exportTree(repo, c.candidateTree, this.store.artifacts(runId), target)
      r.adoption = {
        label: c.label, mode: 'folder', state: 'adopted', startedAt, endedAt: Date.now(),
        exportPath: saved.exportPath, exportDigests: saved.digests, writtenPaths: saved.written,
        ...(r.adoption?.retainedExports?.length ? { retainedExports: r.adoption.retainedExports } : {}),
        message: `已保存 ${saved.written.length} 个文件到 ${saved.exportPath}；没有改动目录里原有的文件${saved.skipped.length ? `。${saved.skipped.length} 个链接或特殊条目没有保存：${saved.skipped.slice(0, 5).join('、')}` : ''}`,
      }
      r.state = 'adopted'
      await this.save(r)
      return r
    }))
  }

  /**
   * Undo a worktree adoption. Refuses (and lists the paths) when any touched
   * file was edited after adoption, so nothing the user wrote is overwritten.
   * A folder save is undone the same way: only unchanged saved files go.
   */
  revert(runId: string): Promise<RunRecord> {
    return this.operation(() => this.revertRun(runId), runId)
  }

  private async revertRun(runId: string): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return withRepositoryWrite(first.baseline.repoRoot, () => this.serial(runId, async () => {
      const r = await this.fresh(runId)
      const a = r.adoption
      if (r.state === 'adopted' && a?.mode === 'folder' && a.exportPath && a.exportDigests) {
        const retained = exportUndoDirectory(a.exportPath)
        // Persist the location before moving any saved file, including an
        // interrupted undo. Originals are never part of preview cleanup.
        ;(a.retainedExports ??= []).push(retained)
        await this.save(r)
        const undo = await removeExport(a.exportPath, a.exportDigests, retained)
        if (undo.changed.length > 0) throw new AdoptError('overlap', `保存之后你改过这些文件，为避免丢失，没有撤销：${undo.changed.slice(0, 10).join('、')}`)
        a.state = 'reverted'
        a.message = undo.folderRemoved ? `已撤销：删除了保存的 ${undo.removed.length} 个文件和文件夹` : `已撤销：删除了保存的 ${undo.removed.length} 个文件；文件夹里还有其它内容，予以保留`
        r.state = 'revealed'
        await this.save(r)
        return r
      }
      if (r.state !== 'adopted' || a?.mode !== 'worktree' || a.preAdoptCommit === undefined || a.writtenPaths === undefined) throw new AdoptError('state', '只有写入工作区或保存到文件夹的采用可以撤销')
      const c = r.candidates.find((x) => x.label === a.label)!
      const repo = r.baseline.repoRoot
      const candidateTree = await treeOf(repo, c.candidateCommit!)
      const now = await snapshotTree(repo, this.store.artifacts(runId), ALWAYS_EXCLUDED)
      const edited = await changedPaths(repo, candidateTree, now, a.writtenPaths)
      if (edited.length > 0) throw new AdoptError('overlap', `采用之后你改过这些文件，为避免覆盖，没有撤销：${edited.slice(0, 10).join('、')}`)
      const protectedApply = a.fileTransfer !== undefined && a.transferDirection !== 'undo'
      if (!protectedApply) {
        if (a.fileTransfer) (a.retainedTransfers ??= []).push(a.fileTransfer)
        a.fileTransfer = newFileTransferRef(); a.transferDirection = 'undo'; a.transferReturn = 'adopted'
      }
      a.state = 'reverting'; r.state = 'adopting'
      await this.save(r)
      const undo = await undoAdoption(repo, this.store.artifacts(runId), { preAdoptCommit: a.preAdoptCommit, candidateCommit: c.candidateCommit!, touched: a.writtenPaths,
        ...(protectedApply ? { transfer: a.fileTransfer! } : { legacyRestore: a.fileTransfer! }),
      })
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
  recoverAdoption(runId: string, action: 'restore' | 'keep'): Promise<RunRecord> {
    return this.operation(() => this.recoverRunAdoption(runId, action), runId)
  }

  private async recoverRunAdoption(runId: string, action: 'restore' | 'keep'): Promise<RunRecord> {
    const first = await this.mustLoad(runId)
    return withRepositoryWrite(first.baseline.repoRoot, () => this.serial(runId, async () => {
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
          const inverseRollback = a.fileTransfer !== undefined && a.transferDirection === 'undo'
          const legacy = a.fileTransfer === undefined
          if (legacy) {
            a.fileTransfer = newFileTransferRef(); a.transferDirection = 'undo'; a.transferReturn = 'recovery'
            a.state = 'reverting'; r.state = 'adopting'
            await this.save(r)
          }
          const undo = await undoAdoption(r.baseline.repoRoot, this.store.artifacts(runId), { preAdoptCommit: a.preAdoptCommit, candidateCommit: c.candidateCommit!, touched: a.writtenPaths,
            ...(legacy ? { legacyRestore: a.fileTransfer! } : { transfer: a.fileTransfer! }),
          })
          if (undo.conflicts.length === 0) {
            if (inverseRollback && a.transferReturn === 'recovery') {
              (a.retainedTransfers ??= []).push(a.fileTransfer!)
              delete a.fileTransfer; delete a.transferDirection; delete a.transferReturn
              a.state = 'needs-recovery'; r.state = 'recovery'
              a.message = '已回退上次未完成的恢复，保留该操作开始前的文件；现在可以重新尝试恢复采用'
            } else {
              a.state = inverseRollback ? 'adopted' : 'rolled-back'
              a.message = inverseRollback ? '已回退未完成的撤销，保留撤销开始前的文件；可以重新审查后再撤销' : `已恢复：${undo.restored.length} 个文件回到采用前的内容`
              r.state = inverseRollback ? 'adopted' : 'revealed'
            }
            delete a.attention
          } else {
            a.state = 'needs-recovery'; r.state = 'recovery'
            a.attention = undo.conflicts
            a.message = `已恢复 ${undo.restored.length} 个文件；另有文件需要处理，当前内容与保留内容均未覆盖：${undo.conflicts.slice(0, 10).join('、')}`
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
  cleanup(runId: string): Promise<RunRecord | undefined> {
    return this.operation(() => this.cleanupRun(runId), runId)
  }

  /** Explicit, inspectable copy release; source records and undo refs remain. */
  async copyCleanupPlan(runId: string, signal?: AbortSignal): Promise<CopyCleanupPlan> {
    const record = await this.mustLoad(runId)
    const control = await this.control(record)
    if (!control.allowed) return { version: 1, runId, rev: record.rev, state: record.state, allowed: false, reasons: [control.reason ?? '当前不可操作这次比较'], resources: [], bytes: 0, token: '' }
    return planCopyCleanup(record, signal)
  }

  releaseCopies(runId: string, token: string): Promise<RunRecord> {
    return this.operation(async () => {
      const initial = await this.mustLoad(runId)
      return withRepositoryWrite(initial.baseline.repoRoot, () => this.serial(runId, async () => {
        const record = await this.fresh(runId)
        // Sizes are not part of the confirmation token; skip re-measuring dependencies.
        const plan = await planCopyCleanup(record, this.lifetime.signal, { measureDependencies: false })
        if (!plan.allowed) throw new BusyError(plan.reasons.join('；'))
        if (!/^[0-9a-f]{64}$/.test(token) || plan.token !== token) throw new BusyError('比较或副本内容在确认后发生变化，尚未删除副本。请重新查看清单。')
        await this.releaseResources(record)
        if (!record.leftovers?.length) record.copiesReleasedAt = Date.now()
        // No abandonment and no dropRefs: selection, sealed source and undo
        // remain usable after disposable dependencies and previews are gone.
        await this.save(record)
        return record
      }), { busyMessage: '仓库正在采用或恢复，请稍后再释放副本' })
    }, runId)
  }

  private async cleanupRun(runId: string): Promise<RunRecord | undefined> {
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
        if (!r.leftovers?.length) await dropRefs(r.baseline.repoRoot, `refs/agent-compare/${runId}/`)
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
      if (c.stopUnconfirmed) {
        leftovers.push(`候选 ${c.label} 的任务进程停止状态未知；保留副本：${c.dir ?? '未记录路径'}。请检查该任务及其子进程后再手动清理。`)
        continue
      }
      try {
        if (lr?.previews.has(c.label)) await this.stopPreview(lr, c.label)
        else if (c.preview !== undefined) await stopOwnedPreview(c.preview)
      } catch (error) {
        const retained = c.dir ?? c.preview?.cwd
        leftovers.push(`候选 ${c.label} 预览未停止：${(error as Error).message}${retained ? `；保留副本：${retained}` : ''}`)
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
    if (reh?.stopUnconfirmed) leftovers.push(`预演进程停止状态未知；保留副本：${reh.dir ?? '未记录路径'}。请检查该任务及其子进程后再手动清理。`)
    else if (reh?.dir !== undefined && reh.ownerToken !== undefined) {
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
  recover(): Promise<string[]> {
    return this.operation(() => this.recoverRuns())
  }

  private async recoverRuns(): Promise<string[]> {
    const touched: string[] = []
    for (const summary of await this.store.list()) {
      if (this.closing) break
      const runId = summary.runId
      if (this.live.has(runId)) continue
      let acquired = false
      try {
        await this.withOwnership(runId, () => {
          acquired = true
          return this.serial(runId, async () => {
            // Re-read after acquiring ownership: the listed record may be stale.
            const r = await this.store.load(runId)
            if (!r || this.live.has(runId)) return
            if (await this.recoverRecord(r)) touched.push(runId)
          })
        }, 'recover')
      } catch (error) {
        if (error instanceof BusyError) continue
        if (acquired) throw error
        // A damaged or inaccessible guard must not hide unrelated history.
        try { this.opts.onRecoveryIssue?.({ runId, message: `无法取得运行归属：${String((error as Error).message).slice(0, 200)}` }) } catch { /* reporting cannot grant ownership */ }
      }
    }
    return touched
  }

  private async recoverRecord(r: RunRecord): Promise<boolean> {
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
      if (r.adoption.state === 'writing' || r.adoption.state === 'reverting') {
        r.adoption.state = 'needs-recovery'
        r.adoption.message = r.adoption.transferDirection === 'undo' ? '撤销过程中宿主停止了。可以回退未完成的撤销，或保留当前文件。' : '文件交接过程中宿主停止了。可以恢复保留的原始内容，或保留当前文件。'
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
    }
    return changed
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.closing = true
    this.lifetime.abort()
    for (const lr of this.live.values()) lr.controller.abort()
    return this.disposal = this.finishDisposal()
  }

  private async finishDisposal(): Promise<void> {
    // Admission is closed: this snapshot includes every accepted operation.
    // Journaled writes finish normally; generation and rehearsal observe abort.
    await Promise.allSettled([...this.operations])
    await Promise.allSettled([...this.live.values()].map(lr => lr.done))
    const errors: unknown[] = []
    for (const lr of this.live.values()) {
      let changed = false
      for (const key of [...lr.previews.keys()]) {
        try {
          await this.stopPreview(lr, key)
          const candidate = lr.record.candidates.find(c => c.label === key)
          if (candidate) delete candidate.preview
          changed = true
        } catch (error) {
          errors.push(error)
          lr.record.leftovers = [...new Set([...(lr.record.leftovers ?? []), `预览 ${key} 等待清理：${(error as Error).message}`])]
          changed = true
        }
      }
      if (changed) {
        try { await this.persist(lr.record) } catch (error) { errors.push(error) }
      }
    }
    // Even a failed cleanup must let a fresh host inspect the retained journal.
    // No owner is released while candidate work or an accepted operation runs.
    for (const runId of this.owners.keys()) {
      try { await this.releaseOwnership(runId, true) } catch (error) { errors.push(error) }
    }
    this.live.clear()
    if (errors.length) throw new AggregateError(errors, '部分比较资源没有停止或保存，请查看历史记录并重试清理')
  }

  private assertOpen(): void {
    if (this.closing) throw new BusyError('比较服务正在停止，请等待宿主重新启动后再试')
  }

  private operation<T>(fn: () => Promise<T>, runId?: string): Promise<T> {
    const pending = Promise.resolve().then(() => { this.assertOpen(); return runId === undefined ? fn() : this.withOwnership(runId, fn) })
    // Add before invoking work, including work that can still be preparing.
    this.operations.add(pending)
    const remove = (): void => { this.operations.delete(pending) }
    void pending.then(remove, remove)
    return pending
  }

  private async ensureOwnership(runId: string, mode: 'start' | 'recover' | 'action' = 'action'): Promise<void> {
    if (!isRunId(runId)) throw new Error('invalid run identifier')
    let pending = this.owners.get(runId)
    if (!pending) {
      pending = (async () => {
        const lease = await this.store.acquireLock(`owner-${runId}`, { busyMessage: '另一个宿主正在管理这次比较；请回到原窗口操作，或等它关闭后重试' })
        try {
          const r = mode === 'start' ? undefined : await this.store.load(runId)
          const reason = r && uncoordinatedReason(r)
          if (reason) throw new BusyError(reason)
          if (mode === 'action' && r && await this.recoverRecord(r)) this.opts.onUpdate?.(r)
          return lease
        } catch (error) { lease.release(); throw error }
      })()
      this.owners.set(runId, pending)
      const acquired = pending
      void acquired.catch(() => { if (this.owners.get(runId) === acquired) this.owners.delete(runId) })
    }
    await pending
  }

  private async withOwnership<T>(runId: string, fn: () => Promise<T>, mode: 'recover' | 'action' = 'action'): Promise<T> {
    this.ownerUses.set(runId, (this.ownerUses.get(runId) ?? 0) + 1)
    try { await this.ensureOwnership(runId, mode); this.assertOpen(); return await fn() }
    finally {
      const uses = (this.ownerUses.get(runId) ?? 1) - 1
      if (uses) this.ownerUses.set(runId, uses)
      else this.ownerUses.delete(runId)
      await this.releaseOwnership(runId)
    }
  }

  private async releaseOwnership(runId: string, force = false): Promise<void> {
    const pending = this.owners.get(runId)
    if (!pending) return
    const lease = await pending.catch(() => undefined)
    if (!force && (this.live.has(runId) || this.ownerUses.has(runId))) return
    if (this.owners.get(runId) !== pending) return
    this.owners.delete(runId)
    lease?.release()
  }

  /** A snapshot for presentation; every action acquires ownership again. */
  async control(r: RunRecord): Promise<{ allowed: boolean; reason?: string; retryable?: boolean; canCancelAdoption?: boolean; adoptionCancellationRequested?: boolean }> {
    if (this.closing) return { allowed: false, reason: '比较服务正在停止' }
    const reason = uncoordinatedReason(r)
    if (reason) return { allowed: false, reason }
    if (this.owners.has(r.runId)) {
      try {
        await this.owners.get(r.runId)
        const pending = this.adoptionControllers.get(r.runId)
        return { allowed: !this.closing, ...(this.closing ? { reason: '比较服务正在停止' } : {}), ...(pending?.record.adoption?.state === 'rehearsing' ? { canCancelAdoption: true, adoptionCancellationRequested: pending.controller.signal.aborted } : {}) }
      }
      catch (error) { return { allowed: false, reason: error instanceof BusyError ? error.message : '无法确认管理归属，当前仅可查看。请检查本地锁文件与访问权限后重试。' } }
    }
    try {
      const lease = await this.store.acquireLock(`owner-${r.runId}`, { busyMessage: 'foreign-running-owner' })
      lease.release()
      return { allowed: !this.closing, ...(this.closing ? { reason: '比较服务正在停止' } : {}) }
    } catch (error) {
      if (error instanceof BusyError) return error.message === 'foreign-running-owner'
        ? { allowed: false, retryable: true, reason: '另一个宿主正在管理这次比较。此处可查看结果；需要选择、停止、采用或清理时，请回到原窗口，或等它关闭后重试。' }
        : { allowed: false, reason: error.message }
      return { allowed: false, reason: '无法确认管理归属，当前仅可查看。请检查本地锁文件与访问权限后重试。' }
    }
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
    r.coordination = RUN_COORDINATION
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

function uncoordinatedReason(r: RunRecord): string | undefined {
  if (r.coordination !== RUN_COORDINATION && needsRecovery(r)) {
    return '这条旧记录没有宿主归属凭据，当前仅可查看。请先关闭旧版本实例，保留记录与副本，再处理其未完成资源；当前版本不会推断旧任务已经退出。'
  }
  return undefined
}

/** The project's directory inside a repository or a copy of it. */
function projectDirectory(root: string, projectPath: string | undefined): string {
  return projectPath ? path.join(root, ...projectPath.split('/')) : root
}

/**
 * Whether the baseline has nothing to build or serve: the run started from a
 * folder, or its project has no shared commands to run.
 */
function nothingToRun(record: RunRecord): boolean {
  return record.target !== undefined || record.acceptance.checks.commands.length === 0
}

function needsRecovery(r: RunRecord): boolean {
  return r.state === 'running' || r.state === 'adopting' || r.candidates.some(c => !SETTLED.has(c.stage) || c.preview !== undefined)
}

class StageFailure extends Error {
  constructor(readonly stage: CandidateStage, message: string) {
    super(message)
  }
}

/** Kill a recorded preview only when its process provably is that preview. */
async function stopOwnedPreview(p: PreviewInfo): Promise<void> {
  const observed = await observeProcess(p.pid)
  if (observed.state === 'unavailable') throw new Error(`无法确认进程 ${p.pid} 的归属：${observed.reason}`)
  if (observed.state === 'observed' && isPreviewProcess(p, observed.commandLine)) {
    await killTree(p.pid)
    if (!await waitGone(p.pid, 5000)) throw new Error(`预览进程 ${p.pid} 未退出`)
  }
}

async function nameStatusOf(repo: string, from: string, to: string): Promise<NameStatus[]> {
  const raw = await git(repo, ['diff', '--name-status', '-z', '--no-renames', from, to])
  const parts = raw.split('\0')
  const out: NameStatus[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) if (parts[i] && parts[i + 1]) out.push({ status: parts[i]!, path: parts[i + 1]! })
  return out
}
