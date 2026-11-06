import { describe, expect, it } from 'vitest'
import { defaultPreferences, parsePreferences, parseUiSubmission, PreferencesStore } from '../src/host/preferences.ts'
import { RunStore } from '../src/core/run-store.ts'
import { tmp } from './fixture.ts'

describe('conversation comparison preferences', () => {
  it('persists selected controls across independent store instances without mixing sessions', async () => {
    const root = await tmp('ac-preferences')
    const first = new PreferencesStore(new RunStore(root))
    expect(await first.load('s1')).toEqual(defaultPreferences())
    const value = { enabled: true, mode: 'cross-model', generationMinutes: 60, models: [{ provider: 'p/one', model: 'a' }, { provider: 'p/two', model: 'b' }] }
    await first.save('s1', value)
    const restarted = new PreferencesStore(new RunStore(root))
    expect(await restarted.load('s1')).toEqual(value)
    expect(await restarted.load('s2')).toEqual(defaultPreferences())
    await restarted.save('s1', { ...value, enabled: false })
    expect((await first.load('s1')).enabled).toBe(false)
  })

  it('rejects invalid budgets and partial provider/model routes', () => {
    for (const generationMinutes of [NaN, Infinity, 0, 121, '60']) expect(() => parsePreferences({ ...defaultPreferences(), generationMinutes })).toThrow()
    expect(() => parsePreferences({ ...defaultPreferences(), models: [{ model: 'missing-provider' }, {}] })).toThrow(/完整配置/)
    expect(() => parsePreferences({ ...defaultPreferences(), exampleKind: 'other' })).toThrow(/示例类型/)
    expect(() => parsePreferences({ ...defaultPreferences(), exampleKind: ['full'] })).toThrow(/示例类型/)
    for (const windowsProcessCompat of ['disabled', true, ['off']]) expect(() => parsePreferences({ ...defaultPreferences(), windowsProcessCompat })).toThrow(/兼容设置/)
  })

  it('retains explicit compatibility settings without changing old preferences', async () => {
    const root = await tmp('ac-compat-preferences'), first = new PreferencesStore(new RunStore(root))
    await first.save('s1', { ...defaultPreferences(), windowsProcessCompat: 'off' })
    expect((await new PreferencesStore(new RunStore(root)).load('s1')).windowsProcessCompat).toBe('off')
    expect((await first.load('s2')).windowsProcessCompat).toBeUndefined()
  })

  it('waits for an admitted save across store instances without blocking another conversation', async () => {
    const root = await tmp('ac-preferences-read-order'), writer = new RunStore(root)
    const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const original = writer.withLock.bind(writer)
    writer.withLock = <T>(key: string, work: () => Promise<T>, options?: Parameters<RunStore['withLock']>[2]) => original(key, async () => { entered.resolve(); await release.promise; return work() }, options)
    const first = new PreferencesStore(writer), second = new PreferencesStore(new RunStore(root))
    const value = { ...defaultPreferences(), enabled: true, generationMinutes: 60 }
    const saving = first.save('same-session', value)
    await entered.promise
    let settled = false
    const reading = second.load('same-session').finally(() => { settled = true })
    try {
      expect(await second.load('other-session')).toEqual(defaultPreferences())
      expect(settled, 'a new view must not read older settings while its previous save owns the session lock').toBe(false)
    } finally { release.resolve() }
    await saving
    expect(await reading).toEqual(value)
  })

  it('retains an explicitly selected example scope without requiring older settings to have it', async () => {
    const store = new PreferencesStore(new RunStore(await tmp('ac-example-preferences')))
    await store.save('example', { ...defaultPreferences(), exampleKind: 'full' })
    expect((await store.load('example')).exampleKind).toBe('full')
    expect(parsePreferences(defaultPreferences()).exampleKind).toBeUndefined()
  })

  it('keeps the exact task, including flag-shaped text, in a structured UI submission', () => {
    const task = 'Explain --minutes 60 literally, then change layout\n第二行 保持  空格'
    const request = { version: 1, task, example: false, preferences: { ...defaultPreferences(), generationMinutes: 60 } }
    expect(parseUiSubmission(` @ui ${JSON.stringify(request)} `)).toEqual({ task, example: false, preferences: request.preferences })
    expect(parseUiSubmission('ordinary task')).toBeUndefined()
    expect(() => parseUiSubmission('@ui {"version":7}')).toThrow()
  })
})
