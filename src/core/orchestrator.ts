import path from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, rmdir } from 'node:fs/promises'
import { addDetachedWorktree, ALWAYS_EXCLUDED, captureChange, changedPaths, commitTree, dropRefs, ensureWorktreePool, git, headCommit, pinRef, removeWorktree, repoRoot, snapshotTree, treeOf, writePatch, readPatchSha } from './git.ts'
import { adoptAsBranch, adoptIntoWorktree, AdoptError, preflight, revertWorktreeAdoption } from './adopt.ts'
import { checksScore, checksSha256, runBrowserCheck, runCommandChecks } from './checks.ts'
import { defaultChecks, inspectProject, installArgv, type ProjectInfo } from './project.ts'
import { startVitePreview, PreviewError, type Preview } from './preview.ts'
import { isAlive, killTree, run } from './proc.ts'
import { newRunId, RunStore } from './run-store.ts'
import { candidatePrompt, DEFAULT_STRATEGIES } from './strategies.ts'
import { RUN_SCHEMA, type AgentRoute, type Candidate, type CandidateLabel, type CandidateStage, type ChecksSpec, type RunRecord, type Strategy, type Usage } from './types.ts'

export interface AgentRunRequest {
  readonly label: CandidateLabel
  readonly cwd: string
  readonly prompt: string
  readonly route: AgentRoute
  readonly signal: AbortSignal
  /** Opaque value from StartInput.hostContext (DSH: the parent Agent). */
  readonly hostContext?: unknown
}

export interface AgentRunResult {
  readonly stopReason: string
  readonly summary?: string
  readonly usage: Usage
  readonly childId?: string
}

/** The one seam to the agent host. DSH implements it with ctx.subagents; tests script it. */
export interface AgentRunner {
  run(request: AgentRunRequest): Promise<AgentRunResult>
}

export interface StartInput {
  readonly repo: string
  readonly task: string
  readonly strategies?: readonly [Strategy, Strategy]
  /** Two different routes switch the run to cross-model mode. */
  readonly routes?: readonly [AgentRoute, AgentRoute]
  readonly checks?: ChecksSpec
  readonly sessionId?: string
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
}

interface LiveRun {
  readonly hostContext: unknown
  readonly controller: AbortController
  readonly perCandidate: Map<CandidateLabel, AbortController>
  readonly previews: Map<CandidateLabel, Preview>
  done: Promise<void>
  saving: Promise<void>
}

const SUMMARY_MAX = 1200

export class Comparer {
  readonly store: RunStore
  private readonly live = new Map<string, LiveRun>()

  constructor(private readonly opts: ComparerOptions) {
    this.store = opts.store ?? new RunStore()
  }

  /** Validate, snapshot the baseline, persist the run, then work in the background. */
  async start(input: StartInput): Promise<RunRecord> {
    const task = input.task.trim()
    if (task === '') throw new Error('task is empty')
    const root = await repoRoot(input.repo)
    const info = await inspectProject(root)
    if (info.kind === 'unsupported') throw new Error(info.reason ?? 'unsupported project')
    const runId = newRunId()
    const scratch = this.store.artifacts(runId)
    await mkdir(scratch, { recursive: true })

    const head = await headCommit(root)
    const tree = await snapshotTree(root, scratch, ALWAYS_EXCLUDED)
    const dirty = head === undefined ? true : tree !== (await treeOf(root, head))
    const snapshotCommit = await commitTree(root, tree, [head], `agent-compare baseline ${runId}`)
    await pinRef(root, `refs/agent-compare/${runId}/base`, snapshotCommit)

    const checks = input.checks ?? defaultChecks(info)
    const strategies = input.strategies ?? DEFAULT_STRATEGIES
    const routes = input.routes ?? [{}, {}]
    const crossModel = JSON.stringify(routes[0]) !== JSON.stringify(routes[1])
    const order: [number, number] = input.assignment === 'fixed' || Math.random() < 0.5 ? [0, 1] : [1, 0]
    const mk = (label: CandidateLabel, i: number): Candidate => ({
      label,
      strategy: strategies[i]!,
      route: routes[i]!,
      stage: 'queued',
      timings: {},
    })
    const record: RunRecord = {
      schema: RUN_SCHEMA,
      producer: { name: 'dsh-agent-compare', version: this.opts.version },
      runId,
      createdAt: Date.now(),
      task,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      baseline: { repoRoot: root, headCommit: head, snapshotCommit, snapshotTree: tree, dirty },
      checks,
      checksSha256: checksSha256(checks),
      mode: crossModel ? 'cross-model' : 'same-model',
      state: 'running',
      candidates: [mk('A', order[0]), mk('B', order[1])],
      updatedAt: Date.now(),
    }
    const liveRun: LiveRun = {
      hostContext: input.hostContext,
      controller: new AbortController(),
      perCandidate: new Map(),
      previews: new Map(),
      done: Promise.resolve(),
      saving: Promise.resolve(),
    }
    this.live.set(runId, liveRun)
    await this.persist(record)
    liveRun.done = this.drive(record, liveRun, info)
    return record
  }

  /** Resolve once every candidate has settled (ready, failed or cancelled). */
  async wait(runId: string): Promise<RunRecord | undefined> {
    await this.live.get(runId)?.done
    return this.get(runId)
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    return this.store.load(runId)
  }

  private persist(record: RunRecord): Promise<void> {
    const lr = this.live.get(record.runId)
    const write = async (): Promise<void> => {
      await this.store.save(record)
      this.opts.onUpdate?.(record)
    }
    if (lr === undefined) return write()
    lr.saving = lr.saving.then(write, write)
    return lr.saving
  }

  private async drive(record: RunRecord, lr: LiveRun, info: ProjectInfo): Promise<void> {
    await Promise.all(record.candidates.map((c) => this.driveCandidate(record, lr, c, info)))
    if (record.state === 'running') {
      record.state = 'judging'
      const [a, b] = record.candidates.map((c) => (c.stage === 'ready' ? checksScore(c.checks) : undefined))
      record.checksFavoured = a === undefined && b === undefined ? 'none' : a === undefined ? 'B' : b === undefined ? 'A' : a > b ? 'A' : b > a ? 'B' : 'tie'
    }
    await this.persist(record)
  }

  private async driveCandidate(record: RunRecord, lr: LiveRun, c: Candidate, info: ProjectInfo): Promise<void> {
    const ctl = new AbortController()
    lr.perCandidate.set(c.label, ctl)
    const signal = AbortSignal.any([lr.controller.signal, ctl.signal])
    const enter = async (stage: CandidateStage): Promise<void> => {
      const prev = c.timings[c.stage]
      if (prev && prev.endedAt === undefined) prev.endedAt = Date.now()
      c.stage = stage
      c.timings[stage] = { startedAt: Date.now() }
      await this.persist(record)
    }
    const artifacts = this.store.artifacts(record.runId)
    try {
      await enter('worktree')
      const pool = await ensureWorktreePool(record.baseline.repoRoot)
      const dir = path.join(pool, `ac-${record.runId}-${c.label}`)
      await addDetachedWorktree(record.baseline.repoRoot, dir, record.baseline.snapshotCommit)
      c.worktree = dir
      signal.throwIfAborted()

      await enter('generating')
      const result = await this.opts.runner.run({ label: c.label, cwd: dir, prompt: candidatePrompt(record.task, c.strategy), route: c.route, signal, hostContext: lr.hostContext })
      c.stopReason = result.stopReason
      c.usage = result.usage
      if (result.childId !== undefined) c.childId = result.childId
      if (result.summary !== undefined) c.summary = result.summary.slice(0, SUMMARY_MAX)
      await this.noteOutsideChanges(record)
      signal.throwIfAborted()
      if (result.stopReason !== 'completed') throw new StageFailure('generating', `agent stopped: ${result.stopReason}`)

      await enter('capturing')
      const change = await captureChange(dir, record.baseline.snapshotCommit, `agent-compare candidate ${record.runId}/${c.label}`)
      if (change.touched.length === 0) {
        // The agent's own account is the only clue to why (e.g. sandbox denials); show its start.
        const why = (result.summary ?? '').replace(/```[\s\S]*?```/g, '').trim().slice(0, 600)
        throw new StageFailure('capturing', `Agent 没有改动任何文件。${why ? `\nAgent 的说明：${why}` : ''}`)
      }
      c.patchFile = path.join(artifacts, `${c.label}.patch`)
      c.patchSha256 = await writePatch(c.patchFile, change.patch)
      c.patchStats = change.stats
      c.touchedFiles = change.touched
      c.candidateCommit = change.commit
      await pinRef(record.baseline.repoRoot, `refs/agent-compare/${record.runId}/${c.label}`, change.commit)

      await enter('installing')
      const candInfo = await inspectProject(dir)
      if (candInfo.kind === 'unsupported') throw new StageFailure('installing', candInfo.reason ?? 'unsupported project after changes')
      let inst = await run(installArgv(candInfo, true), { cwd: dir, timeoutMs: 600_000, signal })
      if (inst.code !== 0 && !inst.aborted && candInfo.lockfile !== undefined) {
        // The candidate changed dependencies without updating the lockfile; record it, then resolve fresh.
        c.summary = `${c.summary ?? ''}\n[agent-compare] frozen install failed; installed without the lockfile.`.trim().slice(0, SUMMARY_MAX)
        inst = await run(installArgv(candInfo, false), { cwd: dir, timeoutMs: 600_000, signal })
      }
      signal.throwIfAborted()
      if (inst.code !== 0) throw new StageFailure('installing', `dependency install failed: ${(inst.stderr || inst.stdout).trim().slice(-800)}`)

      await enter('starting')
      let preview: Preview
      try {
        preview = await startVitePreview(dir, { timeoutMs: this.opts.previewTimeoutMs ?? 60_000, signal })
      } catch (error) {
        if (signal.aborted) throw error
        const log = error instanceof PreviewError ? `\n${error.log.slice(-800)}` : ''
        throw new StageFailure('starting', `${(error as Error).message}${log}`)
      }
      lr.previews.set(c.label, preview)
      c.previewUrl = preview.url
      c.pid = preview.pid
      c.port = preview.port

      await enter('checking')
      const results = await runCommandChecks(dir, record.checks, signal)
      if (record.checks.browser !== undefined && this.opts.browserChecks !== false) {
        const shot = path.join(artifacts, `${c.label}.png`)
        const b = await runBrowserCheck(preview.url, record.checks.browser, shot)
        results.push(b)
        if (b.screenshot !== undefined) c.screenshot = b.screenshot
      }
      c.checks = results
      c.driftAfterChecks = await this.drifted(dir, change.tree)
      signal.throwIfAborted()
      await enter('ready')
    } catch (error) {
      const stage = c.stage
      if (signal.aborted) {
        c.stage = 'cancelled'
      } else {
        c.stage = 'failed'
        c.error = { stage: error instanceof StageFailure ? error.stage : stage, message: String((error as Error).message ?? error).slice(0, 2000) }
      }
      const t = c.timings[stage]
      if (t && t.endedAt === undefined) t.endedAt = Date.now()
      await this.stopPreview(record, c.label)
      await this.persist(record)
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
      if (merged.size !== (record.outsideChanges?.length ?? 0)) {
        record.outsideChanges = [...merged].slice(0, 200)
        await this.persist(record)
      }
    } catch {
      // Detection is best effort; a failure here must not fail the candidate.
    }
  }

  /** Did running the checks leave non-ignored files that differ from what was captured? */
  private async drifted(dir: string, capturedTree: string): Promise<boolean> {
    await git(dir, ['add', '-A', '--', '.', ...ALWAYS_EXCLUDED])
    return (await git(dir, ['write-tree'])).trim() !== capturedTree
  }

  private async stopPreview(record: RunRecord, label: CandidateLabel): Promise<void> {
    const lr = this.live.get(record.runId)
    const p = lr?.previews.get(label)
    if (p) {
      await p.stop()
      lr?.previews.delete(label)
    }
  }

  /** Stop one candidate (the user gave up on it) or the whole run. */
  async cancel(runId: string, label?: CandidateLabel): Promise<void> {
    const lr = this.live.get(runId)
    if (lr === undefined) return
    if (label === undefined) lr.controller.abort()
    else lr.perCandidate.get(label)?.abort()
  }

  async choose(runId: string, pick: CandidateLabel | 'none', note?: string): Promise<RunRecord> {
    return this.mutate(runId, (r) => {
      if (r.state !== 'judging' && r.state !== 'chosen') throw new Error(`cannot choose in state ${r.state}`)
      if (pick !== 'none' && r.candidates.find((c) => c.label === pick)?.stage !== 'ready') throw new Error(`candidate ${pick} is not ready`)
      r.choice = { pick, at: Date.now(), ...(note === undefined ? {} : { note }) }
      r.state = 'chosen'
    })
  }

  async reveal(runId: string): Promise<RunRecord> {
    return this.mutate(runId, (r) => {
      if (r.state !== 'chosen') throw new Error('choose first; the reveal comes after the choice')
      r.state = 'revealed'
    })
  }

  /**
   * Land the chosen candidate. `worktree` writes files into the user's
   * checkout (no commit, index untouched); `branch` only creates a branch.
   */
  async adopt(runId: string, mode: 'worktree' | 'branch' = 'worktree', opts: { verify?: boolean } = {}): Promise<RunRecord> {
    return this.store.withLock(runId, async () => {
      const r = await this.mustLoad(runId)
      if (r.state !== 'revealed' && r.state !== 'adopt-failed') throw new Error(`cannot adopt in state ${r.state}`)
      const pick = r.choice?.pick
      if (pick === undefined || pick === 'none') throw new Error('no candidate was chosen')
      const c = r.candidates.find((x) => x.label === pick)!
      if (c.candidateCommit === undefined || c.patchFile === undefined || c.patchSha256 === undefined) throw new Error('candidate has no captured change')
      if (!existsSync(c.patchFile) || (await readPatchSha(c.patchFile)) !== c.patchSha256) {
        throw new AdoptError('integrity', 'the recorded patch no longer matches what was checked')
      }
      const candTree = await treeOf(r.baseline.repoRoot, c.candidateCommit)
      const nameStatus = await nameStatusOf(r.baseline.repoRoot, r.baseline.snapshotCommit, c.candidateCommit)
      if (candTree === r.baseline.snapshotTree) throw new AdoptError('integrity', 'candidate equals baseline')
      const input = { baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: this.store.artifacts(runId), refPrefix: `refs/agent-compare/${runId}` }
      r.adoption = { label: pick, mode, state: 'adopting', startedAt: Date.now() }
      r.state = 'adopting'
      await this.persist(r)
      try {
        if (mode === 'branch') {
          const { branch } = await adoptAsBranch({ ...input, branch: `agent-compare/${runId}-${pick}` })
          r.adoption.branch = branch
          r.adoption.message = `已创建分支 ${branch}；当前 checkout 和文件均未改动`
        } else {
          const res = await adoptIntoWorktree(input)
          r.adoption.preAdoptCommit = res.preAdoptCommit
          r.adoption.message = `已写入 ${res.verifiedPaths} 个文件，逐个核对与验收过的版本一致${res.targetChanged ? '（基线之后你改过其他文件，与本次改动不重叠）' : ''}；未提交，index 未改动`
          if (opts.verify !== false) r.adoption.verification = await this.verifyTarget(r)
        }
        r.adoption.state = 'adopted'
        r.adoption.endedAt = Date.now()
        r.state = 'adopted'
      } catch (error) {
        r.adoption.state = 'failed'
        r.adoption.endedAt = Date.now()
        r.adoption.message = (error as Error).message
        r.state = 'adopt-failed'
      }
      await this.persist(r)
      return r
    })
  }

  /** Report-only adoption check without writing anything. */
  async adoptPreflight(runId: string): Promise<{ ok: boolean; overlapping?: string[]; targetChanged?: boolean }> {
    const r = await this.mustLoad(runId)
    const pick = r.choice?.pick
    const c = r.candidates.find((x) => x.label === pick)
    if (!c?.candidateCommit) return { ok: false }
    const nameStatus = await nameStatusOf(r.baseline.repoRoot, r.baseline.snapshotCommit, c.candidateCommit)
    const p = await preflight({ baseline: r.baseline, candidateCommit: c.candidateCommit, nameStatus, scratchDir: this.store.artifacts(runId), refPrefix: `refs/agent-compare/${runId}` })
    return p.ok ? { ok: true, targetChanged: p.targetChanged } : { ok: false, overlapping: p.overlapping }
  }

  async revert(runId: string): Promise<RunRecord> {
    return this.store.withLock(runId, async () => {
      const r = await this.mustLoad(runId)
      const a = r.adoption
      if (r.state !== 'adopted' || a?.mode !== 'worktree' || a.preAdoptCommit === undefined) throw new Error('only a worktree adoption can be reverted')
      const c = r.candidates.find((x) => x.label === a.label)!
      const nameStatus = await nameStatusOf(r.baseline.repoRoot, r.baseline.snapshotCommit, c.candidateCommit!)
      await revertWorktreeAdoption({ baseline: r.baseline, candidateCommit: c.candidateCommit!, nameStatus, scratchDir: this.store.artifacts(runId), refPrefix: `refs/agent-compare/${runId}`, preAdoptCommit: a.preAdoptCommit })
      a.state = 'reverted'
      a.message = '已撤销：涉及的文件已恢复到采用前的内容'
      r.state = 'revealed'
      await this.persist(r)
      return r
    })
  }

  /** Re-run the shared command checks in the user's checkout, when it has dependencies installed. */
  private async verifyTarget(r: RunRecord): Promise<RunRecord['candidates'][number]['checks']> {
    if (!existsSync(path.join(r.baseline.repoRoot, 'node_modules'))) {
      return [{ name: 'target', outcome: 'skipped', durationMs: 0, tail: '', reason: '你的仓库里没有 node_modules，未在主仓库重跑检查' }]
    }
    return runCommandChecks(r.baseline.repoRoot, r.checks)
  }

  /** Stop previews, delete candidate worktrees and pinned refs. Run records and patches stay. */
  async cleanup(runId: string): Promise<RunRecord | undefined> {
    const r = await this.store.load(runId)
    if (r === undefined) return undefined
    const lr = this.live.get(runId)
    lr?.controller.abort()
    await lr?.done
    for (const c of r.candidates) {
      await this.stopPreview(r, c.label)
      if (c.pid !== undefined && c.previewUrl !== undefined && isAlive(c.pid) && (await answers(c.previewUrl))) await killTree(c.pid)
      if (c.worktree !== undefined) await removeWorktree(r.baseline.repoRoot, c.worktree)
    }
    // Non-recursive on purpose: only an empty run folder is removed.
    await rmdir(path.join(this.store.worktreesDir, runId)).catch(() => {})
    if (r.state !== 'adopted') await dropRefs(r.baseline.repoRoot, `refs/agent-compare/${runId}/`)
    if (r.state === 'judging' || r.state === 'running' || r.state === 'chosen' || r.state === 'revealed' || r.state === 'interrupted') r.state = 'abandoned'
    this.live.delete(runId)
    await this.store.save(r)
    return r
  }

  /**
   * After a host restart: anything still marked in flight did not finish.
   * Mark it interrupted (never "done"), and stop dev servers that still answer
   * on their recorded URL.
   */
  async recover(): Promise<string[]> {
    const touched: string[] = []
    for (const r of await this.store.list()) {
      if (this.live.has(r.runId)) continue
      let changed = false
      for (const c of r.candidates) {
        if (!['ready', 'failed', 'cancelled', 'interrupted'].includes(c.stage)) {
          c.error = { stage: c.stage, message: 'interrupted: the host stopped while this stage was running' }
          c.stage = 'interrupted'
          changed = true
        }
        if (c.pid !== undefined && c.previewUrl !== undefined && isAlive(c.pid) && (await answers(c.previewUrl))) {
          await killTree(c.pid)
          changed = true
        }
      }
      if (r.state === 'running' || r.state === 'adopting') {
        if (r.state === 'adopting' && r.adoption) {
          r.adoption.state = 'failed'
          r.adoption.message = 'interrupted during adoption; touched files may be partially written. Use revert or inspect the pre-adopt snapshot ref.'
          r.state = 'adopt-failed'
        } else r.state = 'interrupted'
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
      for (const p of lr.previews.values()) await p.stop()
    }
    await Promise.allSettled([...this.live.values()].map((lr) => lr.done))
  }

  private async mustLoad(runId: string): Promise<RunRecord> {
    const r = await this.store.load(runId)
    if (r === undefined) throw new Error(`unknown run ${runId}`)
    return r
  }

  private async mutate(runId: string, fn: (r: RunRecord) => void): Promise<RunRecord> {
    const r = await this.mustLoad(runId)
    fn(r)
    await this.persist(r)
    return r
  }
}

class StageFailure extends Error {
  constructor(readonly stage: CandidateStage, message: string) {
    super(message)
  }
}

async function nameStatusOf(repo: string, from: string, to: string): Promise<Array<{ status: string; path: string }>> {
  const raw = await git(repo, ['diff', '--name-status', '-z', '--no-renames', from, to])
  const parts = raw.split('\0')
  const out: Array<{ status: string; path: string }> = []
  for (let i = 0; i + 1 < parts.length; i += 2) if (parts[i] && parts[i + 1]) out.push({ status: parts[i]!, path: parts[i + 1]! })
  return out
}

async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    await res.body?.cancel()
    return true
  } catch {
    return false
  }
}

export interface PublicCandidate {
  readonly label: CandidateLabel
  readonly stage: CandidateStage
  readonly previewUrl?: string
  readonly checks?: Candidate['checks']
  readonly patchStats?: Candidate['patchStats']
  readonly touchedFiles?: string[]
  readonly timings: Candidate['timings']
  readonly error?: Candidate['error']
  readonly driftAfterChecks?: boolean
  readonly usage?: Usage
  /** Present only after the reveal. */
  readonly strategy?: Strategy
  readonly route?: AgentRoute
  readonly summary?: string
}

/**
 * The view the UI and the model see. Before the reveal it carries nothing
 * that names the strategy or model; summaries are withheld because agents
 * tend to describe their own approach.
 */
export function publicView(r: RunRecord): Omit<RunRecord, 'candidates' | 'baseline'> & { candidates: PublicCandidate[]; baseline: { dirty: boolean; headCommit?: string } } {
  const revealed = ['revealed', 'adopting', 'adopted', 'adopt-failed'].includes(r.state)
  const { candidates, baseline, ...rest } = r
  return {
    ...rest,
    baseline: { dirty: baseline.dirty, ...(baseline.headCommit === undefined ? {} : { headCommit: baseline.headCommit.slice(0, 12) }) },
    candidates: candidates.map((c) => ({
      label: c.label,
      stage: c.stage,
      timings: c.timings,
      ...(c.previewUrl === undefined ? {} : { previewUrl: c.previewUrl }),
      ...(c.checks === undefined ? {} : { checks: c.checks }),
      ...(c.patchStats === undefined ? {} : { patchStats: c.patchStats }),
      ...(c.touchedFiles === undefined ? {} : { touchedFiles: c.touchedFiles }),
      ...(c.error === undefined ? {} : { error: c.error }),
      ...(c.driftAfterChecks === undefined ? {} : { driftAfterChecks: c.driftAfterChecks }),
      ...(c.usage === undefined ? {} : { usage: c.usage }),
      ...(revealed ? { strategy: c.strategy, route: c.route, ...(c.summary === undefined ? {} : { summary: c.summary }) } : {}),
    })),
  }
}
