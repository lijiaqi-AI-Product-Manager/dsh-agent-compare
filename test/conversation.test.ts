import { describe, expect, it } from 'vitest'
import { commandResultText, memoryNote, milestoneOf, parseAbInput, runIdInText } from '../src/host/conversation.ts'
import { RUN_SCHEMA, type RunRecord } from '../src/core/types.ts'
import { ConversationMemory } from '../src/host/memory.ts'

describe('/ab input', () => {
  it('keeps the task verbatim and reads flags anywhere', () => {
    expect(parseAbInput('给商品列表加上搜索框，手机上也要好用')).toEqual({ task: '给商品列表加上搜索框，手机上也要好用', example: false })
    expect(parseAbInput('--minutes 60 重做首页  顶部')).toEqual({ task: '重做首页  顶部', example: false, minutes: 60 })
    expect(parseAbInput('重做首页 --models deepseek/deepseek-chat,other/m2')).toEqual({ task: '重做首页', example: false, models: [{ provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'other', model: 'm2' }] })
    expect(parseAbInput('--example')).toEqual({ task: '', example: true })
  })
  it('refuses malformed flags with a usable message', () => {
    expect(() => parseAbInput('x --minutes 2')).toThrow(/5 到 120/)
    expect(() => parseAbInput('x --models only-one')).toThrow(/两个模型/)
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

  it('retries an offline conversation and a failed injection, preserving target identity', async () => {
    const queued: unknown[] = [], warnings: string[] = []
    let online = false, fail = true
    const agent = { session: { snapshotEvents: () => [] }, inbox: { nextTurn: queued, nextStep: [] }, inject: (m: unknown) => { if (fail) throw new Error('busy'); queued.push(m) } }
    const memory = new ConversationMemory({ findAgent: () => online ? agent : undefined, createMessage: async () => m => m, warn: m => warnings.push(m) })
    const record = run({})
    await memory.remember(record)
    expect(queued).toHaveLength(0)
    online = true
    await memory.remember(record)
    expect(warnings).toHaveLength(1)
    fail = false
    await memory.remember(record)
    await memory.remember(record)
    expect(queued).toHaveLength(1)
    expect(JSON.stringify(queued)).toContain('Target repository: /r')
  })

  it('deduplicates after restart and retries an inbox entry lost before it became history', async () => {
    const events: Array<{ type: string; data: unknown }> = [], queued: unknown[] = []
    const agent = { session: { snapshotEvents: () => events }, inbox: { nextTurn: [], nextStep: queued }, inject: (m: unknown) => { queued.push(m) } }
    const dependencies = { findAgent: () => agent, createMessage: async () => (m: unknown) => m, warn: () => {} }
    const memory = new ConversationMemory(dependencies)
    await memory.remember(run({}))
    queued.length = 0
    await memory.remember(run({}))
    expect(queued).toHaveLength(1)
    events.push({ type: 'user/message', data: { message: queued.shift() } })
    await new ConversationMemory(dependencies).remember(run({}))
    expect(queued).toHaveLength(0)
  })
})
