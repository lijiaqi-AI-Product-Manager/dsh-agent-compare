/**
 * DeepSeek Harness Host half of AgentCompare.
 *
 * - Candidates run as fresh in-process DSH children through `ctx.subagents`
 *   (provider `spawn`), each with its own worktree as `cwd`, so the host's
 *   sandbox treats that worktree as the child's write boundary.
 * - Model-facing tools: `agent_compare_start`, `agent_compare_status`.
 * - Client API: POST /agent-compare/api/<method>, fenced like every first-party route.
 *
 * Only APIs read from the shipped 0.2.1-rc.3 sources are used; anything this
 * file cannot obtain is reported as unknown rather than guessed.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Comparer, publicView, RunStore, defaultHome, type AgentRunner, type AgentRunRequest, type AgentRunResult, type RunRecord } from '../core/index.ts'

export const name = 'agent-compare'
// webServer/connection are optional: headless and SDK profiles have no Web UI,
// and the tools must still work there.
export const inject = ['tools', 'subagents']

export interface Config {
  /** Subagent provider used for candidates. `spawn` is the fresh in-process DSH child. */
  provider?: string
  /** Where run records, patches and worktrees live. */
  home?: string
}

const VERSION = '0.1.0-alpha.3'
const ROUTE = '/agent-compare/api'

// Minimal structural views of the host services this plugin touches.
interface AgentLike { readonly session?: { readonly id?: string } }
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
  subagents: { startActivation(spec: unknown): Promise<Activation>; getProvider(name: string): unknown }
  inject(names: string[], cb: (sub: WebCtx) => void): unknown
  get(name: string): unknown
  effect(fn: () => () => void, label?: string): void
  on(event: string, cb: (...args: unknown[]) => void): void
  logger: { info(m: string): void; warn(m: string): void }
}
interface WorkingDirectory { ensure(agent: AgentLike, signal: AbortSignal): Promise<string> }
interface AgentRegistry { list(): AgentLike[] }

/** Runs one candidate as a `spawn` child of the Agent that asked for the comparison. */
class SubagentRunner implements AgentRunner {
  constructor(private readonly ctx: HostCtx, private readonly provider: string) {}

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const parent = req.hostContext as AgentLike | undefined
    if (parent === undefined) throw new Error('no parent agent: start the comparison from a conversation')
    const agentOptions = req.route.provider !== undefined && req.route.model !== undefined
      ? { provider: req.route.provider, model: req.route.model, ...(req.route.reasoningEffort === undefined ? {} : { reasoningEffort: req.route.reasoningEffort }) }
      : undefined
    const activation = await this.ctx.subagents.startActivation({
      provider: this.provider,
      label: `AgentCompare ${req.label}`,
      request: {
        prompt: [{ type: 'text', text: req.prompt }],
        parent,
        cwd: req.cwd,
        signal: req.signal,
        ...(agentOptions === undefined ? {} : { agentOptions }),
      },
      signal: req.signal,
      // We present the result ourselves; no completion notice is injected into the parent conversation.
      delivery: 'caller',
    })
    const onAbort = (): void => { void activation.dispose() }
    req.signal.addEventListener('abort', onAbort, { once: true })
    try {
      const result = await activation.result
      const summary = result.output.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim()
      return {
        stopReason: result.stopReason,
        childId: activation.childId,
        ...(summary === '' ? (result.diagnostic === undefined ? {} : { summary: result.diagnostic }) : { summary }),
        // dsh-subagent 0.2.1-rc.3 SubagentResult carries no usage field.
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
    baselineDirty: v.baseline.dirty,
    checksFavoured: v.checksFavoured,
    choice: v.choice?.pick,
    adoption: v.adoption === undefined ? undefined : { state: v.adoption.state, mode: v.adoption.mode, message: v.adoption.message },
    candidates: v.candidates.map((c) => ({
      label: c.label,
      stage: c.stage,
      previewUrl: c.previewUrl,
      checks: c.checks?.map((k) => `${k.name}:${k.outcome}`),
      files: c.patchStats?.files,
      error: c.error?.message.split('\n')[0],
      ...(c.strategy === undefined ? {} : { strategy: c.strategy.title }),
    })),
  }
}

export async function apply(ctx: HostCtx, config: Config = {}): Promise<void> {
  const { defineTool } = (await import('@deepseek-ai/dsh-tools' as string)) as { defineTool: (d: unknown) => unknown }
  const comparer = new Comparer({
    store: new RunStore(config.home ?? defaultHome()),
    runner: new SubagentRunner(ctx, config.provider ?? 'spawn'),
    version: VERSION,
  })
  ctx.effect(() => () => { void comparer.dispose() }, 'agent-compare: stop dev servers and candidates')
  const recovered = await comparer.recover()
  if (recovered.length > 0) ctx.logger.info(`agent-compare: marked ${recovered.length} unfinished run(s) as interrupted`)

  const repoFor = async (agent: AgentLike, signal: AbortSignal): Promise<string> => {
    const wd = ctx.get('workingDirectory') as WorkingDirectory | undefined
    if (wd === undefined) throw new Error('the workingDirectory service is unavailable; cannot resolve the project directory')
    return wd.ensure(agent, signal)
  }

  const startFor = async (agent: AgentLike, task: string, signal: AbortSignal): Promise<RunRecord> => {
    const repo = await repoFor(agent, signal)
    return comparer.start({ repo, task, hostContext: agent, ...(agent.session?.id === undefined ? {} : { sessionId: agent.session.id }) })
  }

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'agent_compare_start',
    description:
      'Build two independent implementations of one front-end task (UI layout, interaction, visual design) in isolated copies of the current Git repository, install and start both apps, and run the same checks on each. ' +
      'Use it when the user asks to compare versions or wants to try two approaches before choosing; do not use it for bug fixes or refactors with a single right answer. ' +
      'Waits until both candidates are ready or failed, then returns a blind summary (labels A/B only). The user then tries both live apps in the AgentCompare panel, picks one, and adopts it. Never claim which strategy produced which candidate before the user has chosen.',
    parameters: {
      task: { type: 'string', required: true, description: 'The complete task, as the user stated it, plus any constraints. Both candidates receive exactly this text.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: { task: string }, exec: ToolExec) {
      if (exec.agent === undefined) throw new Error('agent_compare_start must be called by an agent')
      const started = await startFor(exec.agent, args.task, exec.signal)
      const onAbort = (): void => { void comparer.cancel(started.runId) }
      exec.signal.addEventListener('abort', onAbort, { once: true })
      try {
        const done = await comparer.wait(started.runId)
        return { ...(brief(done ?? started) as object), next: 'Ask the user to open the AgentCompare panel (header button), try A and B, and pick one. Do not guess which is better on their behalf.' }
      } finally {
        exec.signal.removeEventListener('abort', onAbort)
      }
    },
  })), 'agent-compare: agent_compare_start tool')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'agent_compare_status',
    description: 'Report the state of an AgentCompare run (or the latest one for this conversation): candidate stages, checks, the user\'s choice and adoption result. Strategy names appear only after the user chose.',
    parameters: { run_id: { type: 'string', description: 'Run id; omit for the latest run of this conversation.' } },
    output: { schema: { type: 'json' }, render: (_a: unknown, v: unknown) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
    async execute(args: { run_id?: string }, exec: ToolExec) {
      const r = args.run_id !== undefined
        ? await comparer.get(args.run_id)
        : (await comparer.store.list()).find((x) => x.sessionId === exec.agent?.session?.id)
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
  const api: Record<string, Handler> = {
    async list(b) {
      const runs = await comparer.store.list()
      const sid = typeof b.sessionId === 'string' ? b.sessionId : undefined
      return runs.filter((r) => sid === undefined || r.sessionId === sid).slice(0, 20).map(publicView)
    },
    async get(b) {
      const r = await comparer.get(runIdOf(b))
      if (r === undefined) throw new HttpError(404, 'unknown run')
      return publicView(r)
    },
    async start(b, signal) {
      const task = typeof b.task === 'string' ? b.task : ''
      const sid = typeof b.sessionId === 'string' ? b.sessionId : undefined
      const agents = ctx.get('agents') as AgentRegistry | undefined
      const agent = agents?.list().find((a) => a.session?.id === sid)
      if (agent === undefined) throw new HttpError(409, 'open the conversation first; candidates run as its subagents')
      const r = await startFor(agent, task, signal)
      return publicView(r)
    },
    async choose(b) {
      const pick = b.pick === 'none' ? 'none' : label(b.pick)
      if (pick === undefined) throw new HttpError(400, 'pick must be A, B or none')
      return publicView(await comparer.choose(runIdOf(b), pick, typeof b.note === 'string' ? b.note.slice(0, 500) : undefined))
    },
    async reveal(b) { return publicView(await comparer.reveal(runIdOf(b))) },
    async preflight(b) { return comparer.adoptPreflight(runIdOf(b)) },
    async adopt(b) { return publicView(await comparer.adopt(runIdOf(b), b.mode === 'branch' ? 'branch' : 'worktree')) },
    async revert(b) { return publicView(await comparer.revert(runIdOf(b))) },
    async cancel(b) { await comparer.cancel(runIdOf(b), label(b.label)); return { ok: true } },
    async cleanup(b) { const r = await comparer.cleanup(runIdOf(b)); return r === undefined ? null : publicView(r) },
    async patch(b) {
      const r = await comparer.get(runIdOf(b))
      const c = r?.candidates.find((x) => x.label === label(b.label))
      if (r === undefined || c?.patchFile === undefined) throw new HttpError(404, 'no patch')
      if (!['revealed', 'adopting', 'adopted', 'adopt-failed'].includes(r.state) && b.blind !== true) throw new HttpError(403, 'diff review opens after the choice')
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
        const status = error instanceof HttpError ? error.status : 500
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
