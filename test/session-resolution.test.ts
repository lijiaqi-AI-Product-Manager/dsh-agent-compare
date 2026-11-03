import { describe, expect, it, vi } from 'vitest'
import { conversationResolver, SessionAccessError } from '../src/host/session.ts'

const agent = (id = 'saved-session') => ({ session: { id }, followup: vi.fn() })
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }

describe('persisted conversation resolution', () => {
  it('restores the exact saved conversation through the Session domain without sending a prompt', async () => {
    const restored = agent(), resolveAgent = vi.fn(async () => ({ agent: restored })), guard = vi.fn()
    const resolve = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent }), guard })
    expect(await resolve('saved-session')).toBe(restored)
    expect(resolveAgent).toHaveBeenCalledExactlyOnceWith('saved-session')
    expect(guard).toHaveBeenCalledExactlyOnceWith(restored)
    expect(restored.followup).not.toHaveBeenCalled()
  })

  it('shares restoration while allowing one caller to cancel independently', async () => {
    const restored = agent(), ready = gate<{ agent: typeof restored }>(), resolveAgent = vi.fn(() => ready.promise), controller = new AbortController()
    const resolve = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent }), guard: () => {} })
    const first = resolve('saved-session', controller.signal), second = resolve('saved-session')
    const cancelled = expect(first).rejects.toThrow('caller cancelled')
    controller.abort(new Error('caller cancelled')); await cancelled
    ready.resolve({ agent: restored })
    expect(await second).toBe(restored)
    expect(resolveAgent).toHaveBeenCalledTimes(1)
    expect(restored.followup).not.toHaveBeenCalled()
  })

  it('does not begin restoration for an already-cancelled caller or invalid identity', async () => {
    const resolveAgent = vi.fn(async () => ({ agent: agent() })), controller = new AbortController()
    controller.abort(new Error('cancelled before request'))
    const resolve = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent }), guard: () => {} })
    await expect(resolve('saved-session', controller.signal)).rejects.toThrow('cancelled before request')
    for (const id of [undefined, null, 1, '', ' ', 'a'.repeat(501)]) await expect(resolve(id)).rejects.toMatchObject({ status: 400 })
    expect(resolveAgent).not.toHaveBeenCalled()
  })

  it('uses native authorization even when an Agent is already attached', async () => {
    const attached = agent(), guard = vi.fn(), resolveAgent = vi.fn(async () => ({ error: { code: 'session/writer-held', message: 'The session has another writer' } }))
    const resolve = conversationResolver({ attached: () => [attached], controller: () => ({ resolveAgent }), guard })
    await expect(resolve('saved-session')).rejects.toMatchObject({ status: 409, message: 'The session has another writer' })
    expect(guard).not.toHaveBeenCalled()
  })

  it('preserves missing-session failures and retries after native resolution fails', async () => {
    const restored = agent(), resolveAgent = vi.fn()
      .mockResolvedValueOnce({ error: { code: 'session/not-found', message: 'Saved session missing' } })
      .mockRejectedValueOnce(new Error('temporary persistence failure'))
      .mockResolvedValue({ agent: restored })
    const resolve = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent }), guard: () => {} })
    await expect(resolve('saved-session')).rejects.toMatchObject({ status: 404, message: 'Saved session missing' })
    await expect(resolve('saved-session')).rejects.toThrow('temporary persistence failure')
    expect(await resolve('saved-session')).toBe(restored)
    expect(resolveAgent).toHaveBeenCalledTimes(3)
  })

  it('rejects an identity mismatch and delegated-session guard without substituting another Agent', async () => {
    const wrong = agent('another-session')
    const mismatch = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent: async () => ({ agent: wrong }) }), guard: () => {} })
    await expect(mismatch('saved-session')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('不同的会话') })
    const delegated = agent(), resolve = conversationResolver({ attached: () => [], controller: () => ({ resolveAgent: async () => ({ agent: delegated }) }), guard: () => { throw new SessionAccessError(403, 'delegated session') } })
    await expect(resolve('saved-session')).rejects.toMatchObject({ status: 403 })
    expect(wrong.followup).not.toHaveBeenCalled(); expect(delegated.followup).not.toHaveBeenCalled()
  })

  it('supports attached-only hosts and explains a missing restoration capability', async () => {
    const attached = agent(), guard = vi.fn()
    const resolve = conversationResolver({ attached: () => [attached], controller: () => undefined, guard })
    expect(await resolve('saved-session')).toBe(attached)
    await expect(resolve('missing-session')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('会话恢复接口') })
    expect(guard).toHaveBeenCalledExactlyOnceWith(attached)
  })
})
