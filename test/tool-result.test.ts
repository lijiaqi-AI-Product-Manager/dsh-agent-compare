import { describe, expect, it } from 'vitest'
import { runIdFromToolResult } from '../src/client/tool-result.ts'

describe('tool card result identity', () => {
  const block = { call: { argsRaw: '{"runId":"aaaaaaaa"}' }, content: [{ type: 'text', text: '{"runId":"1234abcd","state":"running"}' }] }
  it('reads the settled result instead of a run id embedded in the arguments', () => {
    expect(runIdFromToolResult(block, 'result')).toBe('1234abcd')
  })
  it.each(['start', 'preparing', undefined])('does not treat %s arguments as an admitted result', phase => {
    expect(runIdFromToolResult(block, phase)).toBeUndefined()
  })
  it('rejects failed, malformed and nested-only identities', () => {
    expect(runIdFromToolResult({ ...block, isError: true }, 'result')).toBeUndefined()
    for (const text of ['runId 1234abcd', '{"task":{"runId":"1234abcd"}}', '[{"runId":"1234abcd"}]', '{"runId":"../1234abcd"}', '{']) {
      expect(runIdFromToolResult({ content: [{ type: 'text', text }] }, 'result')).toBeUndefined()
    }
  })
})
