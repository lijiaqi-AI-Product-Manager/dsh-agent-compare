import { describe, expect, it } from 'vitest'
import { commandResultText, memoryNote, milestoneOf, parseAbInput, runIdInText } from '../src/host/conversation.ts'
import { RUN_SCHEMA, type RunRecord } from '../src/core/types.ts'
import { StepMemory } from '../src/host/step-memory.ts'

describe('/ab input', () => {
  it('keeps the task verbatim and reads flags anywhere', () => {
    expect(parseAbInput('给商品列表加上搜索框，手机上也要好用')).toEqual({ task: '给商品列表加上搜索框，手机上也要好用', example: false })
    expect(parseAbInput('--minutes 60 重做首页  顶部')).toEqual({ task: '重做首页  顶部', example: false, minutes: 60 })
    expect(parseAbInput('重做首页 --models deepseek/deepseek-chat,other/m2')).toEqual({ task: '重做首页', example: false, models: [{ provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'other', model: 'm2' }] })
    expect(parseAbInput('--example')).toEqual({ task: '', example: true })
  })
  it('refuses malformed flags with a usable message', () => {
    expect(() => parseAbInput('x --minutes 2')).toThrow(/5 到 120/)
    expect(() => parseAbInput('x --models only-one')).toThrow(/2 到 4 个模型/)
    expect(() => parseAbInput('x --models a/1,b/2,c/3,d/4,e/5')).toThrow(/2 到 4 个模型/)
    expect(() => parseAbInput('x --versions 5')).toThrow(/2 到 4/)
    expect(() => parseAbInput('x --versions 3 --models a/1,b/2')).toThrow(/不一致/)
    expect(parseAbInput('做首页 --versions 4')).toEqual({ task: '做首页', example: false, versions: 4 })
    expect(parseAbInput('做首页 --models a/1,b/2,c/3').models).toHaveLength(3)
    expect(() => parseAbInput('x --minutes')).toThrow(/需要一个值/)
  })
  it('round-trips the run id through the command result text', () => {
    expect(runIdInText(commandResultText('0a1b2c3d'))).toBe('0a1b2c3d')
    expect(runIdInText('{"runId": "deadbeef"}')).toBe('deadbeef')
    expect(runIdInText('nothing here')).toBeUndefined()
  })
})

function run(over: Partial<RunRecord>): RunRecord {
  return {
    schema: RUN_SCHEMA, producer: { name: 'dsh-agent-compare', version: 't' }, runId: '0a1b2c3d', createdAt: 1, task: '加搜索',
    sessionId: 's1',
    baseline: { repoRoot: '/r', headCommit: undefined, snapshotCommit: 'b', snapshotTree: 't', dirty: false },
    acceptance: { checks: { commands: [] }, scripts: {}, bound: {}, runtime: { node: 'v', packageManager: 'npm', platform: 'x' }, source: 'defaults', sha256: 'x' },
    mode: 'same-model', isolation: 'own-root', budget: { generationMs: 1 }, state: 'judging',
    candidates: [
      { label: 'A', strategy: { id: 'conservative', title: '稳妥 · Conservative', instruction: '' }, route: { model: 'm' }, stage: 'ready', timings: {}, verdict: { eligible: true, reasons: [], warnings: [] }, patchStats: { files: 2, insertions: 1, deletions: 0, binary: 0 }, touchedFiles: ['src/App.tsx', 'src/styles.css'] },
      { label: 'B', strategy: { id: 'bold', title: '大胆 · Bold', instruction: '' }, route: { model: 'm' }, stage: 'failed', timings: {}, error: { stage: 'installing', message: '冻结安装失败\nmore' } },
    ],
    rev: 1, updatedAt: 1, ...over,
  }
}

describe('conversation memory notes', () => {
  it('describes the blind result without naming strategies', () => {
    const r = run({})
    expect(milestoneOf(r)).toBe('judging')
    const note = memoryNote(r)!
    expect(note).toContain('A: passed the shared acceptance')
    expect(note).toContain('B: did not produce a result (依赖安装未能完成')
    expect(note).not.toMatch(/Conservative|Bold|稳妥|大胆/)
  })
  it('names the pick and its strategy after the choice, and the files after adoption', () => {
    expect(memoryNote(run({ state: 'revealed', choice: { pick: 'A', at: 1 } }))).toMatch(/picked A \(strategy: 稳妥 · Conservative; model: m\)\. It is not adopted yet/)
    const adopted = run({ state: 'adopted', choice: { pick: 'A', at: 1 }, adoption: { label: 'A', mode: 'worktree', state: 'adopted', startedAt: 5, writtenPaths: ['src/App.tsx', 'src/styles.css'] } })
    expect(milestoneOf(adopted)).toBe('adoption:worktree:adopted:5')
    expect(memoryNote(adopted)).toMatch(/now in the target repository's working tree, uncommitted\. Files written: src\/App\.tsx, src\/styles\.css/)
    const reverted = run({ state: 'revealed', choice: { pick: 'A', at: 1 }, adoption: { label: 'A', mode: 'worktree', state: 'reverted', startedAt: 5, writtenPaths: ['src/App.tsx'] } })
    expect(memoryNote(reverted)).toMatch(/was undone/)
    expect(milestoneOf(reverted)).not.toBe(milestoneOf(adopted))
  })
  it('has nothing to say while candidates are still running', () => {
    expect(milestoneOf(run({ state: 'running' }))).toBeUndefined()
    expect(memoryNote(run({ state: 'running' }))).toBeUndefined()
  })
})

/** A session log that grows as steps commit their messages. */
function logSession(id = 's1') {
  const events: Array<{ type: string; data: unknown }> = []
  return { id, events, get seq() { return events.length }, snapshotEvents: (from: number) => events.slice(from), commit(messages: unknown[]) { for (const message of messages) events.push({ type: 'user/message', data: { message } }) } }
}

describe('conversation memory in the conversation\'s own steps', () => {
  const create = async () => (message: unknown) => message

  it('adds each current fact once, in the step that follows it, preserving target identity', async () => {
    const session = logSession()
    let records = [run({})]
    const memory = new StepMemory({ records: async () => records, createMessage: create })
    const first = await memory.messages(session)
    expect(first).toHaveLength(1)
    expect(JSON.stringify(first)).toContain('Target repository: /r')
    expect(memory.delivered(session, records[0]!)).toBe(false)
    session.commit(first)
    expect(memory.delivered(session, records[0]!)).toBe(true)
    expect(await memory.messages(session)).toHaveLength(0)
    records = [run({ state: 'adopted', choice: { pick: 'A', at: 1 }, adoption: { label: 'A', mode: 'worktree', state: 'adopted', startedAt: 5, writtenPaths: ['src/App.tsx'] }, updatedAt: 2 })]
    const adopted = await memory.messages(session)
    expect(JSON.stringify(adopted)).toContain('Files written: src/App.tsx')
    expect(adopted[0]).toMatchObject({ source: { kind: 'agent-compare', runId: '0a1b2c3d', milestone: 'adoption:worktree:adopted:5' } })
  })

  it('retries a step that never committed and deduplicates against the log after a restart', async () => {
    const session = logSession(), records = [run({})]
    const memory = new StepMemory({ records: async () => records, createMessage: create })
    expect(await memory.messages(session)).toHaveLength(1)
    // The step was cancelled before admission: nothing reached the log, so the next step adds it again.
    const retried = await memory.messages(session)
    expect(retried).toHaveLength(1)
    session.commit(retried)
    expect(await new StepMemory({ records: async () => records, createMessage: create }).messages(session)).toHaveLength(0)
  })

  it('only speaks for the owning conversation and stays silent without a message factory', async () => {
    const other = logSession('s2'), records = [run({})]
    expect(await new StepMemory({ records: async () => records, createMessage: create }).messages(other)).toHaveLength(0)
    expect(await new StepMemory({ records: async () => records, createMessage: async () => undefined }).messages(logSession())).toHaveLength(0)
    expect(await new StepMemory({ records: async () => [run({ state: 'running' })], createMessage: create }).messages(logSession())).toHaveLength(0)
  })
})
