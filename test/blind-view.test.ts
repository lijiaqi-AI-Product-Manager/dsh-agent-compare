import { describe, expect, it } from 'vitest'
import { publicView } from '../src/core/orchestrator.ts'
import { memoryNote } from '../src/host/conversation.ts'
import { fixtureRecord } from './record-fixture.ts'

function record() {
  const r = fixtureRecord(), c = r.candidates[0]!
  c.strategy = { id: 'identity-canary', title: 'identity-canary', instruction: 'identity-canary' }
  c.route = c.actualRoute = { provider: 'identity-canary', model: 'identity-canary' }
  c.summary = 'identity-canary'
  c.usage = { kind: 'reported', totalTokens: 87654321 }
  c.patchStats = { files: 7654321, insertions: 654321, deletions: 54321, binary: 0 }
  c.touchedFiles = ['identity-canary.ts']
  c.stage = 'generating'
  c.progress = { steps: 3, lastActivityAt: 10, lastAction: 'identity-canary tool identity-canary.ts', tokens: 87654321 }
  c.error = { stage: 'generating', message: 'identity-canary' }
  c.install!.failure = { kind: 'network', summary: '连接失败', hint: '连接恢复后重试', code: 'ECONNRESET', diagnostic: 'identity-canary' }
  c.checks![0]!.tail = 'identity-canary'
  c.checks![0]!.reason = 'identity-canary'
  c.checks![0]!.steps = [{ label: '共同验收步骤', ok: false, detail: 'identity-canary' }]
  c.verificationHistory = [{ recordedAt: 10, install: c.install, checks: c.checks, error: c.error }]
  c.verdict = { eligible: false, reasons: ['改动了验收相关文件：identity-canary.ts'], warnings: ['Agent 没有正常结束（identity-canary）；以上结论针对它已写的文件'] }
  return r
}

describe('blind public evidence', () => {
  it('withholds compatibility fingerprints until reveal without changing the durable record', () => {
    const r = record(), c = r.candidates[0]!
    c.install!.runtime = { hostNode: process.version, platform: 'win32-x64', packageManager: 'npm', windowsProcessCompat: { mode: 'auto', observedHooks: ['esbuild-service'] } }
    expect(JSON.stringify(publicView(r))).not.toContain('esbuild-service')
    expect(c.install!.runtime.windowsProcessCompat?.observedHooks).toEqual(['esbuild-service'])
    r.revealedAt = Date.now()
    expect(JSON.stringify(publicView(r))).toContain('esbuild-service')
  })
  it.each(['running', 'judging', 'interrupted', 'abandoned'] as const)('withholds usage, scale, tools and candidate prose in %s', state => {
    const r = record(); r.state = state
    const before = structuredClone(r), view = publicView(r), candidate = view.candidates[0]!
    expect(JSON.stringify(view)).not.toMatch(/identity-canary|87654321|7654321|654321|54321/)
    for (const field of ['usage', 'patchStats', 'touchedFiles', 'strategy', 'route', 'actualRoute', 'summary']) expect(candidate).not.toHaveProperty(field)
    expect(candidate.progress).toEqual({ steps: 3, lastActivityAt: 10, lastAction: '正在处理项目' })
    expect(candidate.install?.failure).toEqual({ kind: 'network', summary: '连接失败', hint: '连接恢复后重试', code: 'ECONNRESET' })
    expect(candidate.checks?.[0]).toMatchObject({ name: 'build', outcome: 'passed', durationMs: 10, tail: '' })
    expect(r).toEqual(before)
    expect(memoryNote(r) ?? '').not.toMatch(/identity-canary|changed \d+ file/)
  })
  it('restores full evidence after reveal, including during a later verification retry', () => {
    const r = record(); r.revealedAt = 100
    for (const state of ['revealed', 'running', 'judging'] as const) {
      r.state = state
      const view = publicView(r)
      expect(view.candidates[0]?.usage).toEqual(r.candidates[0]?.usage)
      expect(view.candidates[0]?.patchStats).toEqual(r.candidates[0]?.patchStats)
      expect(JSON.stringify(view)).toContain('identity-canary')
    }
  })
  it('retains the factual no-change explanation without the candidate quotation', () => {
    const r = record(); r.candidates[0]!.error = { stage: 'sealing', message: 'Agent 没有改动任何文件。\nAgent 的说明：identity-canary' }
    expect(publicView(r).candidates[0]?.error?.message).toBe('Agent 没有改动任何文件。')
  })
})
