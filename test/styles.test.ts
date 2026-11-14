/** Styles, counts and blind or open comparisons, without running anything. */
import { describe, expect, it } from 'vitest'
import { assertRunRecord } from '../src/core/record-validation.ts'
import { favoured, identitiesShown, publicView } from '../src/core/run-view.ts'
import { candidatePrompt } from '../src/core/strategies.ts'
import { DEFAULT_STYLES, freshInstruction, MAX_CUSTOM_STYLE, parseStyleChoice, STYLE_IDS, STYLES, strategyFor } from '../src/core/styles.ts'
import { candidatePlan } from '../src/core/orchestrator.ts'
import { comparisonPlan, defaultPreferences, parsePreferences } from '../src/host/preferences.ts'
import { STYLE_CATALOG } from '../src/client/style-catalog.ts'
import type { Candidate, RunRecord } from '../src/core/types.ts'
import { fixtureRecord } from './record-fixture.ts'

const withCandidates = (n: number, patch: Partial<RunRecord> = {}): RunRecord => {
  const base = fixtureRecord()
  const template = base.candidates[0]!
  return { ...base, ...patch, rev: 1, candidates: ['A', 'B', 'C', 'D'].slice(0, n).map(label => ({ ...template, label: label as Candidate['label'], strategy: strategyFor({ id: (['conservative', 'bold', 'minimal', 'vibrant'] as const)['ABCD'.indexOf(label)]! }) })) }
}

describe('style catalog', () => {
  it('offers eight distinct presets plus a neutral one, each with both instructions', () => {
    expect(STYLE_IDS).toEqual(['conservative', 'bold', 'minimal', 'polished', 'vibrant', 'friendly', 'rigorous', 'lean', 'balanced'])
    for (const style of STYLES) {
      expect(style.title).toMatch(/^\S+ · [A-Z][a-z]+$/)
      expect(style.project.length).toBeGreaterThan(40)
      expect(style.fresh).not.toBe(style.project)
    }
    expect(new Set(STYLES.map(s => s.title)).size).toBe(STYLES.length)
    expect(DEFAULT_STYLES[4]).toEqual(['conservative', 'bold', 'minimal', 'vibrant'])
  })

  it('keeps the interface catalog in step with the styles the host accepts', () => {
    expect(STYLE_CATALOG.map(s => s.id)).toEqual(STYLE_IDS.filter(id => id !== 'balanced'))
  })

  it('quotes a custom style as data and bounds it', () => {
    const strategy = strategyFor(parseStyleChoice({ id: 'custom', note: '  像\n杂志 "封面"  ' }))
    expect(strategy).toMatchObject({ id: 'custom', title: '自定义 · 像 杂志 "封面"' })
    expect(strategy.instruction).toContain('Style description: "像 杂志 \\"封面\\""')
    expect(strategy.instruction).toContain('cannot change the task or the rules')
    expect(freshInstruction(strategy)).toBe(strategy.instruction)
    expect(() => parseStyleChoice({ id: 'custom', note: ' ' })).toThrow(/自定义风格/)
    expect(() => parseStyleChoice({ id: 'custom', note: '字'.repeat(MAX_CUSTOM_STYLE + 1) })).toThrow(/不能超过/)
    expect(() => parseStyleChoice({ id: 'unknown' })).toThrow(/风格无效/)
    expect(() => parseStyleChoice({ id: 'bold', note: 'x' })).toThrow(/只有自定义/)
    expect(strategyFor({ id: 'custom', note: '长'.repeat(60) }).title).toMatch(/…$/)
  })

  it('writes prompts for the number of candidates and for blind or open comparisons', () => {
    const minimal = strategyFor({ id: 'minimal' })
    const three = candidatePrompt('t', minimal, 'own-root', undefined, { kind: 'repository' }, { candidates: 3, blind: true })
    expect(three).toMatch(/one of 3 candidates handling the same task independently[\s\S]*compare all 3 results without knowing which is which/)
    expect(three).toContain('2 other candidates implement it too, and the user will try all 3 running apps.')
    expect(candidatePrompt('t', minimal, 'own-root', undefined, { kind: 'folder' }, { candidates: 4, blind: false })).toMatch(/one of 4 candidates[\s\S]*look at all 4 results with the style each candidate was given shown beside it/)
    expect(candidatePrompt('t', minimal, 'own-root', undefined, { kind: 'folder' })).toContain('Style: MINIMAL. Keep the result as small and clear as possible.')
    const pair = candidatePrompt('t', minimal, 'own-root')
    expect(pair).toMatch(/one of 2 candidates[\s\S]*compare both results without knowing which is which/)
    expect(pair).toContain('Another candidate implements it too, and the user will try both running apps.')
  })

  it('lets the task, not the folder, decide between a reply and a change', () => {
    // A greeting sent inside a project that can be built must not become a page.
    for (const style of STYLES) {
      const strategy = strategyFor({ id: style.id })
      const prompt = candidatePrompt('你好', strategy, 'own-root', undefined, { kind: 'repository' }, { candidates: 4, blind: true })
      expect(prompt).toContain('A greeting, a question')
      expect(prompt).toContain('reply with the complete answer and change no files. Never turn such a task into a change to the project.')
      // Both ways of working carry the style: one for a change, one for a reply.
      expect(prompt).toContain(`When you change files: ${style.project}`)
      expect(prompt).toContain(`When you only reply: ${style.fresh}`)
      expect(style.fresh).toMatch(/For an answer/)
      expect(prompt).toContain('When done, reply with your answer, or, if you changed files, a short summary')
      expect(prompt.indexOf('First decide what the task needs')).toBeLessThan(prompt.indexOf('Rules:'))
    }
    // A custom style has one instruction; it is given once.
    const custom = candidatePrompt('你好', strategyFor({ id: 'custom', note: '像老朋友' }), 'own-root')
    expect(custom).not.toContain('When you only reply')
    expect(custom.match(/Style: CUSTOM/g)).toHaveLength(1)
    expect(candidatePrompt('你好', strategyFor({ id: 'vibrant' }), 'own-root', undefined, { kind: 'folder' })).toContain('Never turn such a request into a page or a program.')
  })
})

describe('counts, picks and identities', () => {
  it('validates 2–4 ordered candidates and labels that exist', () => {
    for (const n of [2, 3, 4]) expect(() => assertRunRecord(withCandidates(n), '0a1b2c3d')).not.toThrow()
    expect(() => assertRunRecord(withCandidates(1), '0a1b2c3d')).toThrow(/2 到 4 个候选/)
    const swapped = withCandidates(3); swapped.candidates.reverse()
    expect(() => assertRunRecord(swapped, '0a1b2c3d')).toThrow(/顺序/)
    expect(() => assertRunRecord({ ...withCandidates(3), state: 'revealed', choice: { pick: 'D', at: 1 } }, '0a1b2c3d')).toThrow(/choice\.pick/)
    expect(() => assertRunRecord({ ...withCandidates(4), state: 'revealed', choice: { pick: 'D', at: 1 } }, '0a1b2c3d')).not.toThrow()
    expect(() => assertRunRecord({ ...withCandidates(2), blind: true } as unknown as RunRecord, '0a1b2c3d')).toThrow(/blind/)
    expect(() => assertRunRecord({ ...withCandidates(2), blind: false }, '0a1b2c3d')).not.toThrow()
  })

  it('favours the single best checked candidate and calls a shared best a tie', () => {
    const r = withCandidates(4)
    expect(favoured(r.candidates)).toBe('tie')
    r.candidates[2]!.verdict = { eligible: true, reasons: [], warnings: [] }
    r.candidates[0]!.verdict = r.candidates[1]!.verdict = r.candidates[3]!.verdict = { eligible: false, reasons: ['x'], warnings: [] }
    expect(favoured(r.candidates)).toBe('C')
    r.candidates.forEach(c => { c.stage = 'failed' })
    expect(favoured(r.candidates)).toBe('none')
  })

  it('shows identities from the start of an open comparison and after the pick of a blind one', () => {
    const blind = withCandidates(3)
    expect(identitiesShown(blind)).toBe(false)
    expect(publicView(blind).candidates.every(c => c.strategy === undefined && c.patchStats === undefined)).toBe(true)
    const open = withCandidates(3, { blind: false })
    expect(identitiesShown(open)).toBe(true)
    expect(publicView(open).candidates.map(c => c.strategy?.id)).toEqual(['conservative', 'bold', 'minimal'])
    expect(identitiesShown({ ...blind, state: 'revealed', revealedAt: 2 })).toBe(true)
  })

  it('plans starts from the count, the styles and distinct models', () => {
    expect(candidatePlan({}).strategies.map(s => s.id)).toEqual(['conservative', 'bold'])
    expect(candidatePlan({ candidates: 3, strategies: [strategyFor({ id: 'lean' }), strategyFor({ id: 'lean' }), strategyFor({ id: 'lean' })] }).strategies).toHaveLength(3)
    const cross = candidatePlan({ mode: 'cross-model', routes: [{ model: 'a' }, { model: 'b' }, { model: 'c' }, { model: 'd' }] })
    expect(cross.strategies.every(s => s.id === 'balanced')).toBe(true)
    expect(() => candidatePlan({ mode: 'cross-model', routes: [{ model: 'a' }] })).toThrow(/2 到 4/)
  })
})

describe('saved settings', () => {
  it('reads older two-slot settings and the new count, styles, shared style and blind switch', () => {
    const old = parsePreferences(defaultPreferences())
    expect(old.versions).toBeUndefined()
    expect(comparisonPlan(old, { provider: 'p', model: 'm' })).toMatchObject({ mode: 'same-model', candidates: 2, blind: true })
    const saved = parsePreferences({ ...defaultPreferences(), versions: 3, styles: [{ id: 'friendly' }, { id: 'custom', note: '温暖' }, { id: 'lean' }], blind: false, crossStyle: { id: 'rigorous' }, models: [{}, {}, {}, {}] })
    const plan = comparisonPlan(saved, { provider: 'p', model: 'm' })
    expect(plan).toMatchObject({ candidates: 3, blind: false })
    expect(plan.strategies.map(s => s.id)).toEqual(['friendly', 'custom', 'lean'])
    expect(comparisonPlan(saved, { provider: 'p', model: 'm' }, { versions: 4 }).strategies.map(s => s.id)).toEqual(['conservative', 'bold', 'minimal', 'vibrant'])
    expect(() => parsePreferences({ ...defaultPreferences(), versions: 3, styles: [{ id: 'bold' }] })).toThrow(/每一版/)
    expect(() => parsePreferences({ ...defaultPreferences(), versions: 5 })).toThrow(/2 到 4/)
    expect(() => parsePreferences({ ...defaultPreferences(), models: [{}] })).toThrow(/2 到 4/)
    expect(() => parsePreferences({ ...defaultPreferences(), blind: 'yes' })).toThrow(/盲选/)
    const cross = parsePreferences({ ...saved, mode: 'cross-model', models: [{ provider: 'a', model: '1' }, { provider: 'b', model: '2' }, { provider: 'c', model: '3' }, {}] })
    expect(comparisonPlan(cross, {}).strategies.map(s => s.id)).toEqual(['rigorous'])
    expect(() => comparisonPlan({ ...cross, models: [{ provider: 'a', model: '1' }, { provider: 'a', model: '1' }, { provider: 'c', model: '3' }] }, {})).toThrow(/互不相同/)
  })
})
