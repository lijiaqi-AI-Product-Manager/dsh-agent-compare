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
  })

  it('keeps the exact task, including flag-shaped text, in a structured UI submission', () => {
    const task = 'Explain --minutes 60 literally, then change layout\n第二行 保持  空格'
    const request = { version: 1, task, example: false, preferences: { ...defaultPreferences(), generationMinutes: 60 } }
    expect(parseUiSubmission(` @ui ${JSON.stringify(request)} `)).toEqual({ task, example: false, preferences: request.preferences })
    expect(parseUiSubmission('ordinary task')).toBeUndefined()
    expect(() => parseUiSubmission('@ui {"version":7}')).toThrow()
  })
})
