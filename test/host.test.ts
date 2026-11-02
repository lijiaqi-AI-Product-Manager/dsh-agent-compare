/**
 * The DSH seam without a running DSH: a structural fake of `ctx.agents`
 * records exactly how a candidate session is created and driven.
 */
import { describe, expect, it } from 'vitest'
import { IsolatedSessionRunner, finalText, progressOf, stopReasonOf, usageFromEvents } from '../src/host/index.ts'

interface Ev { type: string; data?: any }

function fakeAgents(script: (child: FakeChild) => void) {
  const created: any[] = []
  const disposed: string[] = []
  class FakeChild {
    events: Ev[] = []
    inbox = { nextTurn: [] as unknown[], nextStep: [] as unknown[] }
    cancelled: unknown[] = []
    options = { provider: 'deepseek', model: 'deepseek-chat' }
    session: any
    constructor(readonly opts: any) {
      this.options = opts.agentOptions ?? this.options
      const events = this.events
      this.session = {
        id: opts.sessionId,
        header: { ...opts.meta },
        get seq() { return events.length },
        append: (type: string, data: unknown) => { events.push({ type, data }) },
        snapshotEvents: (from: number) => events.slice(from),
        requestHeader: () => events.some(e => e.type === 'assistant/message') ? { config: this.options } : undefined,
      }
    }
    followup(m: unknown) { this.events.push({ type: 'user/message', data: m }); script(this) }
    cancel(cause: unknown) { this.cancelled.push(cause); this.events.push({ type: 'turn/end', data: { reason: { kind: 'aborted' } } }) }
    whenIdle() { return Promise.resolve() }
  }
  const agents = {
    list: () => [],
    async create(opts: any) {
      const child = new FakeChild(opts)
      const childCtx = { get: (n: string) => (n === 'approval' ? {} : undefined), systemPrompt: { context: (s: unknown) => created.push({ context: s }), getContextOrder: () => 7 } }
      await opts.setup(childCtx, child)
      created.push(opts)
      return { agent: child, dispose: async () => { disposed.push(opts.sessionId) } }
    },
  }
  return { agents, created, disposed }
}

const parent = {
  session: { id: 'session-parent', header: { cwd: 'D:\\project', delegationDepth: 0 }, seq: 0, append() {}, snapshotEvents: () => [] },
  ctx: { get: () => undefined },
  options: { provider: 'deepseek', model: 'deepseek-chat' },
  followup() {}, cancel() {}, whenIdle: async () => {},
}

const completes = (child: { events: Ev[] }) => {
  child.events.push({ type: 'turn/start' })
  child.events.push({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'thinking' }] }, usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50, totalTokens: 160 } } })
  child.events.push({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Done: added search.' }] }, usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220 } } })
  child.events.push({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
}

describe('isolated candidate session', () => {
  it('creates the session with the copy as its cwd and pins the sandbox and approval policy', async () => {
    const { agents, created, disposed } = fakeAgents(completes)
    const runner = new IsolatedSessionRunner(agents, async () => (m: unknown) => m)
    const res = await runner.run({ label: 'A', cwd: 'C:\\home\\w\\run\\A', prompt: 'do it', route: {}, signal: new AbortController().signal, hostContext: parent })
    const opts = created.find((c) => c.meta)
    expect(opts.meta).toMatchObject({ cwd: 'C:\\home\\w\\run\\A', parentSession: 'session-parent', origin: 'subagent', delegationDepth: 1 })
    expect(opts.parentAgent).toBe(parent)
    expect(opts.agentOptions).toEqual({ provider: 'deepseek', model: 'deepseek-chat' })
    expect(res).toMatchObject({ stopReason: 'completed', summary: 'Done: added search.', actualRoute: { provider: 'deepseek', model: 'deepseek-chat' } })
    expect(res.usage).toEqual({ kind: 'reported', inputTokens: 300, outputTokens: 30, totalTokens: 380 })
    expect(created.some((c) => c.context?.name === 'agent-compare:candidate')).toBe(true)
    expect(disposed).toEqual([opts.sessionId])
  })

  it('writes the policy events into the child log before it runs', async () => {
    let first: Ev[] = []
    const { agents } = fakeAgents((child) => { first = child.events.slice(0, 2); completes(child) })
    await new IsolatedSessionRunner(agents, async () => (m: unknown) => m).run({ label: 'B', cwd: '/copy', prompt: 'x', route: {}, signal: new AbortController().signal, hostContext: parent })
    expect(first).toEqual([
      { type: 'sandbox/mode', data: { mode: 'workspace-write', source: 'delegation' } },
      { type: 'approval/policy', data: { policy: 'never', source: 'delegation' } },
    ])
  })

  it('uses an explicit route for cross-model runs', async () => {
    const { agents, created } = fakeAgents(completes)
    await new IsolatedSessionRunner(agents, async () => (m: unknown) => m).run({ label: 'A', cwd: '/c', prompt: 'x', route: { provider: 'other', model: 'm2' }, signal: new AbortController().signal, hostContext: parent })
    expect(created.find((c) => c.meta).agentOptions).toEqual({ provider: 'other', model: 'm2' })
  })

  it('a stop that arrives before the first turn never lets the session run, and disposes it', async () => {
    const ctl = new AbortController()
    ctl.abort()
    let ran = false
    const { agents, disposed } = fakeAgents(() => { ran = true })
    await expect(new IsolatedSessionRunner(agents, async () => (m: unknown) => m).run({ label: 'A', cwd: '/c', prompt: 'x', route: {}, signal: ctl.signal, hostContext: parent })).rejects.toThrow(/cancelled/)
    expect(ran).toBe(false)
    expect(disposed).toHaveLength(1)
  })

  it('refuses without a parent conversation', async () => {
    const { agents } = fakeAgents(completes)
    await expect(new IsolatedSessionRunner(agents, async () => (m: unknown) => m).run({ label: 'A', cwd: '/c', prompt: 'x', route: {}, signal: new AbortController().signal })).rejects.toThrow(/没有父会话/)
  })
})

describe('session log readers', () => {
  it('summarises live progress: steps, latest tool call and tokens', () => {
    expect(progressOf([
      { type: 'step/start' },
      { type: 'tool/call', data: { name: 'read', arguments: '{"file_path":"C:\\\\copy\\\\src\\\\App.tsx"}' } },
      { type: 'assistant/message', data: { message: { content: [] }, usage: { totalTokens: 1200 } } },
      { type: 'step/start' },
      { type: 'tool/call', data: { name: 'pwsh', arguments: '{"command":"npm run   typecheck"}' } },
    ])).toEqual({ steps: 2, lastAction: 'pwsh npm run typecheck', tokens: 1200 })
    expect(progressOf([{ type: 'tool/call', data: { name: 'write', arguments: '{"file_path":"C:\\\\c' } }])).toEqual({ steps: 0, lastAction: 'write' })
  })

  it('reports unknown usage when the provider reported none', () => {
    expect(usageFromEvents([{ type: 'assistant/message', data: { message: { content: [] } } }])).toMatchObject({ kind: 'unknown' })
  })
  it('maps turn endings onto stop reasons', () => {
    expect(stopReasonOf([])).toBe('error')
    expect(stopReasonOf([{ type: 'turn/end', data: { reason: { kind: 'max-tokens' } } }])).toBe('max-tokens')
    expect(stopReasonOf([{ type: 'turn/end', data: { reason: { kind: 'blocked' } } }])).toBe('refusal')
    expect(stopReasonOf([{ type: 'turn/end', data: { reason: { kind: 'something-new' } } }])).toBe('error')
  })
  it('selects the last non-empty assistant message', () => {
    expect(finalText([
      { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'a' }] } } },
      { type: 'assistant/message', data: { message: { content: [] } } },
    ])).toBe('a')
  })
})
