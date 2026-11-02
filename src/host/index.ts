/**
 * DeepSeek Harness Host half of AgentCompare.
 *
 * - Each candidate runs in its own DSH session created with `ctx.agents.create`
 *   whose session `cwd` is the candidate's private copy. DSH's sandbox takes a
 *   session's write boundary from that `cwd`, so the candidate can write only
 *   inside its copy, enforced before it runs ("own-root"). When the host has no
 *   agent factory, the `ctx.subagents` child path is used instead
 *   ("shared-root": copies inside the repository, escapes detected afterwards).
 * - Model-facing tools: `agent_compare_start`, `agent_compare_status`.
 * - Client API: POST /agent-compare/api/<method>, fenced like every first-party route.
 *
 * Only APIs read from the shipped 0.2.1-rc.3 sources are used; anything this
 * file cannot obtain is reported as unknown rather than guessed.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  Comparer, publicView, RunStore, defaultHome, createExampleRepo, EXAMPLE_TASK, DEFAULT_GENERATION_MS,
  type AgentRoute, type AgentRunner, type AgentRunRequest, type AgentRunResult, type RunRecord, type Usage,
} from '../core/index.ts'

export const name = 'agent-compare'
// webServer/connection are optional: headless and SDK profiles have no Web UI,
// and the tools must still work there.
export const inject = ['tools', 'agents']

export interface Config {
  /** `own-root` (default) or the experimental `shared-root` subagent path. */
  isolation?: 'own-root' | 'shared-root'
  /** Subagent provider for `shared-root`. */
  provider?: string
  /** Per-candidate generation budget in minutes. */
  generationMinutes?: number
  /** Comparisons generating at the same time. */
  maxActiveRuns?: number
  /** Where run records, patches and copies live. */
  home?: string
}

const VERSION = '0.2.0-alpha.1'
const ROUTE = '/agent-compare/api'

// Minimal structural views of the host services this plugin touches.
interface SessionEvent { readonly type: string; readonly data?: any }
interface SessionLike {
  readonly id: string
  readonly header: { readonly cwd?: string; readonly origin?: string; readonly delegationDepth?: number }
  readonly seq: number
  append(type: string, data: unknown): void
  snapshotEvents(from: number): readonly SessionEvent[]
}
interface AgentLike {
  readonly id?: string
  readonly session: SessionLike
  readonly ctx: { get(name: string): unknown }
  readonly options?: { readonly provider?: string; readonly model?: string; readonly reasoningEffort?: string }
  readonly inbox?: { readonly nextTurn: readonly unknown[]; readonly nextStep: readonly unknown[] }
  followup(message: unknown): void
  cancel(cause: unknown): void
  whenIdle(): Promise<void>
}
interface AgentHandle { readonly agent: AgentLike; dispose(): Promise<void> }
interface AgentsService { create(options: unknown): Promise<AgentHandle>; list(): AgentLike[] }
interface ChildCtx {
  get(name: string): unknown
  systemPrompt?: { context(spec: { name: string; order?: number; text: string }): void; getContextOrder?(name: string): number }
}
interface PresetService { composedPreset?(ctx: unknown): unknown; composeFrom?(child: unknown, parent: unknown): void }
interface ToolExec { readonly agent?: AgentLike; readonly signal: AbortSignal }
interface ContentBlock { readonly type: string; readonly text?: string }
interface Activation { readonly childId: string; readonly result: Promise<{ output: readonly ContentBlock[]; stopReason: string; diagnostic?: string }>; dispose(): Promise<void> }
interface WebCtx {
  webServer: { register(route: { kind: 'prefix' | 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void }): () => void }
  connection: { requestRejection(req: IncomingMessage): unknown }
  effect(fn: () => () => void, label?: string): void
}
interface HostCtx {
  tools: { register(def: unknown): () => void }
  inject(names: string[], cb: (sub: WebCtx) => void): unknown
  get(name: string): unknown
  effect(fn: () => () => void, label?: string): void
  logger: { info(m: string): void; warn(m: string): void }
}
interface WorkingDirectory { ensure(agent: AgentLike, signal: AbortSignal): Promise<string> }
interface LlmService { listProviders(): Array<{ id: string; name?: string }>; listModels(provider: string): Promise<Array<{ provider: string; id: string; name: string }>> }

const DELEGATION_TEXT = 'You are a delegated candidate agent for AgentCompare: your permission scope was fixed when you were started and cannot be widened from inside this session — operations that require approval are rejected automatically. Your file writes are limited to your working directory. When the task needs access beyond that scope, do not retry the denied operation; state the limitation in your reply.'

/** A session started by AgentCompare (or any delegated child) must not start another comparison. */
function isDelegated(agent: AgentLike): boolean {
  return agent.session.header.origin === 'subagent'
}

/** Sum of the usage the provider reported on each assistant message, or unknown when none did. */
export function usageFromEvents(events: readonly SessionEvent[]): Usage {
  let seen = false
  const sum = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, totalTokens: 0 }
  for (const e of events) {
    const u = e.type === 'assistant/message' ? e.data?.usage : undefined
    if (u === undefined || u === null || typeof u !== 'object') continue
    seen = true
    for (const k of Object.keys(sum) as Array<keyof typeof sum>) if (typeof u[k] === 'number') sum[k] += u[k]
  }
  return seen ? { kind: 'reported', ...sum } : { kind: 'unknown', reason: 'the session reported no token usage' }
}

/** Last non-empty assistant message text, as DSH's own subagent result selects it. */
export function finalText(events: readonly SessionEvent[]): string {
  let last: readonly ContentBlock[] | undefined
  for (const e of events) {
    const content = e.type === 'assistant/message' ? (e.data?.message?.content as ContentBlock[] | undefined) : undefined
    if (content !== undefined && content.length > 0) last = content
  }
  return (last ?? []).filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim()
}

/** Map the epoch's last turn ending onto the subagent stop-reason vocabulary. */
export function stopReasonOf(events: readonly SessionEvent[]): string {
  const ends = events.filter((e) => e.type === 'turn/end')
  const kind = ends.at(-1)?.data?.reason?.kind as string | undefined
  if (ends.length === 0) return 'error'
  switch (kind) {
    case 'max-tokens': return 'max-tokens'
    case 'aborted':
    case 'interrupted': return 'aborted'
    case 'error': return 'error'
    case 'blocked': return 'refusal'
    case undefined:
    case 'completed': return 'completed'
    default: return 'error'
  }
}

/**
 * Runs one candidate in a fresh DSH session whose `cwd` is the candidate copy.
 * The session's sandbox mode is pinned to workspace-write and approvals to
 * `never`, the same policy DSH gives its own delegated children, but the write
 * root is the copy instead of the parent's project.
 */
export class IsolatedSessionRunner implements AgentRunner {
  readonly isolation = 'own-root' as const
  constructor(
    private readonly agents: AgentsService,
    private readonly userMessage: () => Promise<(m: unknown) => unknown> = async () => ((await import('@deepseek-ai/dsh-llm' as string)) as { createUserMessage: (m: unknown) => unknown }).createUserMessage,
  ) {}

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const parent = req.hostContext as AgentLike | undefined
    if (parent === undefined) throw new Error('没有父会话：请在对话中发起比较')
    const createUserMessage = await this.userMessage()
    const route = req.route.model !== undefined ? req.route : (parent.options ?? {})
    const agentOptions = route.provider !== undefined && route.model !== undefined
      ? { provider: route.provider, model: route.model, ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }) }
      : undefined
    const presets = parent.ctx.get('agentPresets') as PresetService | undefined
    const agentPreset = presets?.composedPreset?.(parent.ctx)
    const handle = await this.agents.create({
      sessionId: randomUUID(),
      parentAgent: parent,
      meta: {
        cwd: req.cwd,
        parentSession: parent.session.id,
        isSeeded: false,
        origin: 'subagent',
        delegationDepth: (parent.session.header.delegationDepth ?? 0) + 1,
        ...(agentPreset === undefined ? {} : { agentPreset }),
      },
      ...(agentOptions === undefined ? {} : { agentOptions }),
      signal: req.signal,
      setup: (childCtx: ChildCtx, child: AgentLike) => {
        child.session.append('sandbox/mode', { mode: 'workspace-write', source: 'delegation' })
        if (childCtx.get('approval') !== undefined) child.session.append('approval/policy', { policy: 'never', source: 'delegation' })
        presets?.composeFrom?.(childCtx, parent.ctx)
        let order: number | undefined
        try { order = childCtx.systemPrompt?.getContextOrder?.('SUBAGENT_DELEGATION') } catch { order = undefined }
        childCtx.systemPrompt?.context({ name: 'agent-compare:candidate', ...(order === undefined ? {} : { order }), text: DELEGATION_TEXT })
      },
    })
    const child = handle.agent
    const start = child.session.seq
    const onAbort = (): void => { try { child.cancel({ kind: 'parent' }) } catch { /* already stopped */ } }
    req.signal.addEventListener('abort', onAbort, { once: true })
    try {
      // A stop that landed while the session was being created would otherwise never reach it.
      if (req.signal.aborted) throw new Error('cancelled before the candidate started')
      child.followup(createUserMessage({ content: [{ type: 'text', text: req.prompt }], source: { kind: 'user' } }))
      // Quiescent = idle with nothing queued and at least one turn ended (or cancelled).
      for (;;) {
        await child.whenIdle()
        const pending = (child.inbox?.nextTurn.length ?? 0) + (child.inbox?.nextStep.length ?? 0)
        const ended = child.session.snapshotEvents(start).some((e) => e.type === 'turn/end')
        if (pending === 0 && (ended || req.signal.aborted)) break
        await new Promise((r) => setTimeout(r, 250))
      }
      const events = child.session.snapshotEvents(start)
      const summary = finalText(events)
      const actual = child.options
      return {
        stopReason: req.signal.aborted ? 'aborted' : stopReasonOf(events),
        childId: child.session.id,
        ...(summary === '' ? {} : { summary }),
        usage: usageFromEvents(events),
        ...(actual?.model === undefined ? {} : { actualRoute: { ...(actual.provider === undefined ? {} : { provider: actual.provider }), model: actual.model, ...(actual.reasoningEffort === undefined ? {} : { reasoningEffort: actual.reasoningEffort }) } }),
      }
    } finally {
      req.signal.removeEventListener('abort', onAbort)
      await handle.dispose().catch(() => {})
    }
  }
}

/** Experimental fallback: a `ctx.subagents` child, whose write root is the parent's project. */
class SubagentRunner implements AgentRunner {
  readonly isolation = 'shared-root' as const
  constructor(private readonly subagents: { startActivation(spec: unknown): Promise<Activation> }, private readonly provider: string) {}

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const parent = req.hostContext as AgentLike | undefined
    if (parent === undefined) throw new Error('没有父会话：请在对话中发起比较')
    const agentOptions = req.route.provider !== undefined && req.route.model !== undefined
      ? { provider: req.route.provider, model: req.route.model, ...(req.route.reasoningEffort === undefined ? {} : { reasoningEffort: req.route.reasoningEffort }) }
      : undefined
    const activation = await this.subagents.startActivation({
      provider: this.provider,
      label: `AgentCompare ${req.label}`,
      request: { prompt: [{ type: 'text', text: req.prompt }], parent, cwd: req.cwd, signal: req.signal, ...(agentOptions === undefined ? {} : { agentOptions }) },
      signal: req.signal,
      // We present the result ourselves; no completion notice is injected into the parent conversation.
      delivery: 'caller',
    })
    const onAbort = (): void => { void activation.dispose() }
    req.signal.addEventListener('abort', onAbort, { once: true })
    if (req.signal.aborted) onAbort()
    try {
      const result = await activation.result
      const summary = result.output.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim()
      return {
        stopReason: result.stopReason,
        childId: activation.childId,
        ...(summary === '' ? (result.diagnostic === undefined ? {} : { summary: result.diagnostic }) : { summary }),
        usage: { kind: 'unknown', reason: 'the DSH subagent result does not report token usage' },
      }
    } finally {
      req.signal.removeEventListener('abort', onAbort)
    }
  }
}

function brief(r: RunRecord): unknown {
  const v = publicView(r)
  return {
    runId: v.runId,
    state: v.state,
    mode: v.mode,
    isolation: v.isolation,
    baselineDirty: v.baseline.dirty,
    acceptance: v.acceptance.checks,
    checksFavoured: v.checksFavoured,
    choice: v.choice?.pick,
    adoption: v.adoption === undefined ? undefined : { state: v.adoption.state, mode: v.adoption.mode, message: v.adoption.message },
    candidates: v.candidates.map((c) => ({
      label: c.label,
      stage: c.stage,
      previewUrl: c.previewUrl,
      checks: c.checks?.map((k) => `${k.name}:${k.outcome}`),
      eligible: c.verdict?.eligible,
      blockers: c.verdict?.reasons,
      files: c.patchStats?.files,
      error: c.error?.message.split('\n')[0],
      ...(c.strategy === undefined ? {} : { strategy: c.strategy.title }),
    })),
  }
}

export async function apply(ctx: HostCtx, config: Config = {}): Promise<void> {
  const { defineTool } = (await import('@deepseek-ai/dsh-tools' as string)) as { defineTool: (d: unknown) => unknown }
  const agents = ctx.get('agents') as AgentsService | undefined
  const subagents = ctx.get('subagents') as { startActivation(spec: unknown): Promise<Activation> } | undefined
  let runner: AgentRunner
  if (config.isolation !== 'shared-root' && typeof agents?.create === 'function') runner = new IsolatedSessionRunner(agents)
  else if (subagents !== undefined) {
    runner = new SubagentRunner(subagents, config.provider ?? 'spawn')
    if (config.isolation !== 'shared-root') ctx.logger.warn('agent-compare: no agent factory on this host; falling back to shared-root subagents (escapes are detected, not prevented)')
  } else throw new Error('agent-compare needs ctx.agents (or ctx.subagents) to run candidates')

  const store = new RunStore(config.home ?? defaultHome())
  const comparer = new Comparer({
    store,
    runner,
    version: VERSION,
    generationMs: (config.generationMinutes ?? DEFAULT_GENERATION_MS / 60_000) * 60_000,
    maxActiveRuns: config.maxActiveRuns ?? 1,
  })
  ctx.effect(() => () => { void comparer.dispose() }, 'agent-compare: stop previews and candidates')
  const recovered = await comparer.recover()
  if (recovered.length > 0) ctx.logger.info(`agent-compare: settled ${recovered.length} unfinished run(s) after restart`)

  const repoFor = async (agent: AgentLike, signal: AbortSignal): Promise<string> => {
    const wd = ctx.get('workingDirectory') as WorkingDirectory | undefined
    if (wd === undefined) throw new Error('workingDirectory 服务不可用，无法确定项目目录')
    return wd.ensure(agent, signal)
  }
  /** Freeze the parent's current route so a mid-run model switch cannot split the pair. */
  const currentRoute = (agent: AgentLike): AgentRoute => {
    const o = agent.options ?? {}
    return { ...(o.provider === undefined ? {} : { provider: o.provider }), ...(o.model === undefined ? {} : { model: o.model }), ...(o.reasoningEffort === undefined ? {} : { reasoningEffort: o.reasoningEffort }) }
  }
  const guard = (agent: AgentLike): void => {
    if (isDelegated(agent)) throw new HttpError(403, '候选或子 Agent 不能再发起比较')
  }

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'agent_compare_start',
    description:
      'Build two independent implementations of one front-end task (UI layout, interaction, visual design) in isolated copies of the current Git repository, build and serve both apps, and run the same bound checks on each. ' +
      'Use it when the user asks to compare versions or wants to try two approaches before choosing; do not use it for bug fixes or refactors with a single right answer. ' +
      'Waits until both candidates are ready or failed, then returns a blind summary (labels A/B only). The user then tries both live apps in the AgentCompare panel, picks one, and adopts it. Never claim which strategy produced which candidate before the user has chosen.',
    parameters: {
      task: { type: 'string', required: true, description: 'The complete task, as the user stated it, plus every requirement and constraint. Both candidates receive exactly this text.' },
      time_limit_minutes: { type: 'number', description: 'Per-candidate generation budget in minutes (default 30).' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: { task: string; time_limit_minutes?: number }, exec: ToolExec) {
      if (exec.agent === undefined) throw new Error('agent_compare_start must be called by an agent')
      if (isDelegated(exec.agent)) return { error: 'A delegated or candidate agent cannot start another comparison.' }
      const minutes = typeof args.time_limit_minutes === 'number' && args.time_limit_minutes > 0 ? Math.min(args.time_limit_minutes, 120) : undefined
      const started = await comparer.start({
        repo: await repoFor(exec.agent, exec.signal),
        task: args.task,
        routes: [currentRoute(exec.agent), currentRoute(exec.agent)],
        hostContext: exec.agent,
        sessionId: exec.agent.session.id,
        ...(minutes === undefined ? {} : { generationMs: minutes * 60_000 }),
      })
      const onAbort = (): void => { void comparer.cancel(started.runId) }
      exec.signal.addEventListener('abort', onAbort, { once: true })
      try {
        const done = await comparer.wait(started.runId)
        return { ...(brief(done ?? started) as object), next: 'Ask the user to open the AgentCompare panel (A|B header button), try A and B, and pick one. Do not guess which is better on their behalf.' }
      } finally {
        exec.signal.removeEventListener('abort', onAbort)
      }
    },
  })), 'agent-compare: agent_compare_start tool')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'agent_compare_status',
    description: 'Report the state of an AgentCompare run (or the latest one for this conversation): candidate stages, checks, adoption eligibility, the user\'s choice and adoption result. Strategy names appear only after the user chose.',
    parameters: { run_id: { type: 'string', description: 'Run id; omit for the latest run of this conversation.' } },
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
    async execute(args: { run_id?: string }, exec: ToolExec) {
      const r = args.run_id !== undefined
        ? await comparer.get(args.run_id)
        : (await store.list()).find((x) => x.sessionId === exec.agent?.session.id)
      return r === undefined ? { error: 'no such run' } : brief(r)
    },
  })), 'agent-compare: agent_compare_status tool')

  type Handler = (body: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
  const runIdOf = (b: Record<string, unknown>): string => {
    const id = b.runId
    if (typeof id !== 'string' || !/^[0-9a-f]{8}$/.test(id)) throw new HttpError(400, 'runId is required')
    return id
  }
  const label = (v: unknown): 'A' | 'B' | undefined => (v === 'A' || v === 'B' ? v : undefined)
  const agentFor = (b: Record<string, unknown>): AgentLike => {
    const sid = typeof b.sessionId === 'string' ? b.sessionId : undefined
    const agent = agents?.list().find((a) => a.session.id === sid)
    if (agent === undefined) throw new HttpError(409, '请先打开这个对话；候选会作为它的子会话运行')
    guard(agent)
    return agent
  }
  const view = async (runId: string): Promise<unknown> => {
    const r = await comparer.get(runId)
    if (r === undefined) throw new HttpError(404, 'unknown run')
    return publicView(r)
  }
  const routeOf = (v: unknown): AgentRoute | undefined => {
    if (v === null || typeof v !== 'object') return undefined
    const o = v as Record<string, unknown>
    return typeof o.model === 'string' && o.model !== '' ? { ...(typeof o.provider === 'string' ? { provider: o.provider } : {}), model: o.model } : undefined
  }
  const api: Record<string, Handler> = {
    async list(b) {
      const all = await store.listAll()
      const sid = typeof b.sessionId === 'string' ? b.sessionId : undefined
      return {
        runs: all.current.filter((r) => sid === undefined || r.sessionId === sid).slice(0, 30).map(publicView),
        legacy: all.legacy.slice(0, 20),
        isolation: runner.isolation,
      }
    },
    async get(b) { return view(runIdOf(b)) },
    async models(b) {
      const agent = agentFor(b)
      const llm = ctx.get('llm') as LlmService | undefined
      const models: Array<{ provider: string; providerName: string; id: string; name: string }> = []
      for (const p of llm?.listProviders() ?? []) {
        const listed = await llm!.listModels(p.id).catch(() => [])
        for (const m of listed) models.push({ provider: p.id, providerName: p.name ?? p.id, id: m.id, name: m.name })
      }
      return { current: currentRoute(agent), models }
    },
    async start(b, signal) {
      const agent = agentFor(b)
      const task = typeof b.task === 'string' ? b.task : ''
      const mode = b.mode === 'cross-model' ? 'cross-model' : 'same-model'
      const pair = Array.isArray(b.models) ? b.models.map(routeOf) : []
      if (mode === 'cross-model' && (pair[0] === undefined || pair[1] === undefined)) throw new HttpError(400, '请选择两个模型')
      const routes: [AgentRoute, AgentRoute] = mode === 'cross-model' ? [pair[0]!, pair[1]!] : [currentRoute(agent), currentRoute(agent)]
      const follows = typeof b.follows === 'string' && /^[0-9a-f]{8}$/.test(b.follows) ? b.follows : undefined
      const repo = b.example === true ? await createExampleRepo(store.examplesDir) : await repoFor(agent, signal)
      const r = await comparer.start({
        repo,
        task: b.example === true && task.trim() === '' ? EXAMPLE_TASK : task,
        mode,
        routes,
        hostContext: agent,
        sessionId: agent.session.id,
        ...(follows === undefined ? {} : { follows }),
      })
      return publicView(r)
    },
    async choose(b) {
      const pick = b.pick === 'none' ? 'none' : label(b.pick)
      if (pick === undefined) throw new HttpError(400, 'pick must be A, B or none')
      return publicView(await comparer.choose(runIdOf(b), pick, typeof b.note === 'string' ? b.note.slice(0, 500) : undefined))
    },
    async preflight(b) { return comparer.adoptPreflight(runIdOf(b)) },
    async adopt(b) { return publicView(await comparer.adopt(runIdOf(b), b.mode === 'branch' ? 'branch' : 'worktree')) },
    async revert(b) { return publicView(await comparer.revert(runIdOf(b))) },
    async recover(b) { return publicView(await comparer.recoverAdoption(runIdOf(b), b.action === 'keep' ? 'keep' : 'restore')) },
    async cancel(b) { const r = await comparer.cancel(runIdOf(b), label(b.label)); return r === undefined ? null : publicView(r) },
    async cleanup(b) { const r = await comparer.cleanup(runIdOf(b)); return r === undefined ? null : publicView(r) },
    async shot(b) {
      const r = await comparer.get(runIdOf(b))
      const c = r?.candidates.find((x) => x.label === label(b.label))
      const file = b.mobile === true ? c?.mobileScreenshot : c?.screenshot
      if (file === undefined) throw new HttpError(404, 'no screenshot')
      return { dataUrl: `data:image/png;base64,${(await readFile(file)).toString('base64')}` }
    },
    async patch(b) {
      const r = await comparer.get(runIdOf(b))
      const c = r?.candidates.find((x) => x.label === label(b.label))
      if (r === undefined || c?.patchFile === undefined) throw new HttpError(404, 'no patch')
      if (r.revealedAt === undefined) throw new HttpError(403, '选择之后才能查看改动')
      const text = await readFile(c.patchFile, 'utf8')
      return { sha256: c.patchSha256, truncated: text.length > 400_000, text: text.slice(0, 400_000) }
    },
  }

  ctx.inject(['webServer', 'connection'], (web) => web.effect(() => web.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      if (web.connection.requestRejection(req) !== undefined) return json(res, 403, { ok: false, error: 'forbidden' })
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
      const method = new URL(req.url ?? '/', 'http://dsh.internal').pathname.slice(ROUTE.length + 1)
      const handler = Object.hasOwn(api, method) ? api[method] : undefined
      if (handler === undefined) return json(res, 404, { ok: false, error: `unknown method ${method}` })
      const ctl = new AbortController()
      res.once('close', () => { if (!res.writableEnded) ctl.abort() })
      try {
        const body = await readBody(req)
        json(res, 200, { ok: true, value: await handler(body, ctl.signal) })
      } catch (error) {
        const status = error instanceof HttpError ? error.status : (error as Error).name === 'BusyError' ? 409 : 500
        json(res, status, { ok: false, error: (error as Error).message })
      }
    },
  }), 'agent-compare: /agent-compare/api routes'))
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 256 * 1024) throw new HttpError(413, 'body too large')
    chunks.push(chunk as Buffer)
  }
  if (size === 0) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'body must be a JSON object')
  return parsed as Record<string, unknown>
}
