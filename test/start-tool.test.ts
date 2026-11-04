import { describe, expect, it, vi } from 'vitest'
import { startToolComparison } from '../src/host/start-tool.ts'
import { defaultPreferences } from '../src/host/preferences.ts'

function setup() {
  const saved = { ...defaultPreferences(), generationMinutes: 60, mode: 'cross-model' as const, models: [{ provider: 'service-a', model: 'model-a' }, { provider: 'service-b', model: 'model-b' }] as const }
  const controller = new AbortController(), agent = { session: { id: 'main-session' } }
  const exec = { agent, signal: controller.signal, callId: 'call-a' }
  const ports = { preferences: vi.fn(async () => saved), currentRoute: vi.fn(() => ({ provider: 'current', model: 'selected' })), repoFor: vi.fn(async () => 'project'), start: vi.fn(async (_input: unknown) => ({ runId: '1234abcd', state: 'running' })) }
  return { saved, controller, agent, exec, ports }
}

describe('background start tool', () => {
  it('returns admission immediately with saved models, budget and the actual call identity', async () => {
    const { exec, ports, saved } = setup()
    const result = await startToolComparison({ task: 'complete task' }, exec, ports)
    expect(result).toMatchObject({ runId: '1234abcd', state: 'running', background: true })
    expect(ports.start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'cross-model', routes: saved.models, generationMs: 3600000, origin: { kind: 'tool', id: 'call-a' }, sessionId: 'main-session' }))
    expect(result.next).toContain('main conversation can continue')
  })
  it('honors an explicit same-model override and valid time boundary', async () => {
    const { exec, ports } = setup()
    await startToolComparison({ task: 'task', mode: 'same-model', time_limit_minutes: 5 }, exec, ports)
    const input: any = ports.start.mock.calls[0]![0]
    expect(input.mode).toBe('same-model')
    expect(input.routes).toEqual([{ provider: 'current', model: 'selected' }, { provider: 'current', model: 'selected' }])
    expect(input.generationMs).toBe(300000)
  })
  it.each([0, 0.1, 4.99, 120.01, Infinity, NaN])('refuses invalid minutes %s before start', async minutes => {
    const { exec, ports } = setup()
    await expect(startToolComparison({ task: 'task', time_limit_minutes: minutes }, exec, ports)).rejects.toThrow(/5 到 120/)
    expect(ports.start).not.toHaveBeenCalled()
  })
  it('accepts the upper budget boundary', async () => {
    const { exec, ports } = setup()
    await startToolComparison({ task: 'task', time_limit_minutes: 120 }, exec, ports)
    expect(ports.start).toHaveBeenCalledWith(expect.objectContaining({ generationMs: 7200000 }))
  })
  it('keeps the parent-inherited provider usable in same-model mode', async () => {
    const { exec, ports } = setup()
    ports.currentRoute.mockReturnValue({ model: 'selected' } as any)
    await startToolComparison({ task: 'task', mode: 'same-model' }, exec, ports)
    expect(ports.start).toHaveBeenCalledWith(expect.objectContaining({ routes: [{ model: 'selected' }, { model: 'selected' }] }))
  })
  it('rejects missing models and duplicate cross-model routes', async () => {
    const { exec, ports, saved } = setup()
    ports.preferences.mockResolvedValue({ ...saved, models: [{}, {}] } as any)
    await expect(startToolComparison({ task: 'task' }, exec, ports)).rejects.toThrow(/两个完整/)
    ports.preferences.mockResolvedValue({ ...saved, models: [saved.models[0], saved.models[0]] } as any)
    await expect(startToolComparison({ task: 'task' }, exec, ports)).rejects.toThrow(/不同/)
    expect(ports.start).not.toHaveBeenCalled()
  })
  it('does not start if admission is cancelled during project resolution', async () => {
    const { exec, ports, controller } = setup()
    ports.repoFor.mockImplementation(async () => { controller.abort(); return 'project' })
    await expect(startToolComparison({ task: 'task' }, exec, ports)).rejects.toThrow()
    expect(ports.start).not.toHaveBeenCalled()
  })
  it('does not attach cancellation listeners to the admitted run', async () => {
    const { exec, ports, controller } = setup()
    const listener = vi.spyOn(exec.signal, 'addEventListener')
    await startToolComparison({ task: 'task' }, exec, ports)
    controller.abort()
    expect(listener).not.toHaveBeenCalled()
    expect(ports.start).toHaveBeenCalledTimes(1)
  })
  it('returns a run admitted during an invocation abort so its identity remains recoverable', async () => {
    const { exec, ports, controller } = setup()
    ports.start.mockImplementation(async () => { controller.abort(); return { runId: '1234abcd', state: 'running' } })
    expect(await startToolComparison({ task: 'task' }, exec, ports)).toMatchObject({ runId: '1234abcd' })
  })
  it('rejects blank tasks, invalid mode and a previously cancelled invocation', async () => {
    const { exec, ports, controller } = setup()
    await expect(startToolComparison({ task: ' ' }, exec, ports)).rejects.toThrow(/完整需求/)
    await expect(startToolComparison({ task: 'task', mode: 'invalid' as any }, exec, ports)).rejects.toThrow(/方式/)
    controller.abort()
    await expect(startToolComparison({ task: 'task' }, exec, ports)).rejects.toThrow()
    expect(ports.start).not.toHaveBeenCalled()
  })
})
