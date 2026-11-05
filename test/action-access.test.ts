import { describe, expect, it, vi } from 'vitest'
import { authorizeComparisonAction, CONVERSATION_ACTIONS } from '../src/host/action-access.ts'
import { fixtureRecord } from './record-fixture.ts'

const caller = (id = 'session-one', origin?: string) => ({ session: { id, header: { ...(origin ? { origin } : {}) } } })
describe('conversation intent for comparison actions', () => {
  it('rejects missing or delegated callers before reading a record', async () => {
    const get = vi.fn(async () => fixtureRecord())
    for (const actor of [undefined, caller('', undefined), caller('candidate', 'subagent')]) {
      await expect(authorizeComparisonAction({ get }, actor, '0a1b2c3d', true)).rejects.toMatchObject({ status: 403 })
    }
    expect(get).not.toHaveBeenCalled()
  })
  it('allows the owning conversation without confirmation and reads without orphan reconciliation', async () => {
    const get = vi.fn(async () => fixtureRecord())
    await expect(authorizeComparisonAction({ get }, caller(), '0a1b2c3d', undefined)).resolves.toBeUndefined()
    expect(get).toHaveBeenCalledExactlyOnceWith('0a1b2c3d')
  })
  it.each([undefined, false, 'true', 1, {}])('requires literal confirmation for another conversation (%j)', async confirmation => {
    await expect(authorizeComparisonAction({ get: async () => fixtureRecord() }, caller('other'), '0a1b2c3d', confirmation)).rejects.toMatchObject({ status: 409, code: 'other-session-confirmation' })
  })
  it('allows one explicit cross-conversation action and rechecks later requests', async () => {
    const get = vi.fn(async () => fixtureRecord())
    await expect(authorizeComparisonAction({ get }, caller('other'), '0a1b2c3d', true)).resolves.toBeUndefined()
    await expect(authorizeComparisonAction({ get }, caller('other'), '0a1b2c3d', undefined)).rejects.toMatchObject({ code: 'other-session-confirmation' })
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('does not infer ownership for old records without a conversation', async () => {
    const record = fixtureRecord(); delete record.sessionId
    const comparer = { get: async () => record }
    await expect(authorizeComparisonAction(comparer, caller(), record.runId, undefined)).rejects.toMatchObject({ code: 'other-session-confirmation' })
    await expect(authorizeComparisonAction(comparer, caller(), record.runId, true)).resolves.toBeUndefined()
  })
  it('fails closed for an absent record or a cancelled permission check', async () => {
    await expect(authorizeComparisonAction({ get: async () => undefined }, caller(), '0a1b2c3d', true)).rejects.toMatchObject({ status: 404 })
    const ctl = new AbortController(), get = vi.fn(async () => { ctl.abort(); return fixtureRecord() })
    await expect(authorizeComparisonAction({ get }, caller(), '0a1b2c3d', true, ctl.signal)).rejects.toThrow()
    const beforeRead = vi.fn(async () => fixtureRecord())
    await expect(authorizeComparisonAction({ get: beforeRead }, caller(), '0a1b2c3d', true, ctl.signal)).rejects.toThrow()
    expect(beforeRead).not.toHaveBeenCalled()
  })
  it('covers write and resource-control routes while retaining read-only history and patch access', () => {
    for (const method of ['choose', 'adopt', 'revert', 'recover', 'cancel', 'cancelAdoption', 'cleanup', 'releaseCopies', 'salvage', 'retryVerification', 'reopen']) expect(CONVERSATION_ACTIONS.has(method)).toBe(true)
    for (const method of ['list', 'get', 'patch', 'shot', 'copyCleanupPlan']) expect(CONVERSATION_ACTIONS.has(method)).toBe(false)
  })
})
