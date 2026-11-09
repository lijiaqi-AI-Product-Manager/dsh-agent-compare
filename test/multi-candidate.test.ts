/**
 * Three and four candidates with chosen styles, blind and open: every
 * candidate runs and is served, labels follow the order, a blind comparison
 * hides and shuffles identities, an open one shows them in the chosen order,
 * and any candidate can be picked, saved or adopted.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, publicView, type AgentRunner, type AgentRunRequest } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { git } from '../src/core/git.ts'
import { fetchPreview } from '../src/core/preview-url.ts'
import { strategyFor, type StyleChoice } from '../src/core/styles.ts'
import { memoryNote } from '../src/host/conversation.ts'
import { prepareFixtureProcess, tmp } from './fixture.ts'

/** Each candidate writes a page that names the style it was given. */
function pages(prompts: AgentRunRequest[]): AgentRunner {
  return {
    isolation: 'own-root',
    async run(req) {
      prompts.push(req)
      const style = /(?:Strategy|Style): ([A-Z]+)/.exec(req.prompt)?.[1] ?? 'BALANCED'
      await writeFile(path.join(req.cwd, 'index.html'), `<h1>${style}</h1>`)
      return { stopReason: 'completed', summary: `made a ${style.toLowerCase()} page`, usage: { kind: 'unknown', reason: 'scripted' } }
    },
  }
}

async function comparer(prompts: AgentRunRequest[]) {
  const store = new RunStore(await tmp('ac-multi-home'))
  return new Comparer({ store, runner: pages(prompts), version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, previewTimeoutMs: 60_000 })
}

const styles = (...choices: StyleChoice[]) => choices.map(strategyFor)
const T = 300_000

describe('more than two candidates', () => {
  it('runs four styled versions in a folder, hides them until the pick, and saves the third', async () => {
    const folder = await tmp('ac-multi-folder')
    const prompts: AgentRunRequest[] = []
    const c = await comparer(prompts)
    try {
      const started = await c.start({ repo: folder, task: '做一个番茄钟网页', candidates: 4, strategies: styles({ id: 'conservative' }, { id: 'minimal' }, { id: 'vibrant' }, { id: 'custom', note: '像复古游戏机' }), assignment: 'fixed' })
      expect(started.candidates.map(x => x.label)).toEqual(['A', 'B', 'C', 'D'])
      const done = (await c.wait(started.runId))!
      expect(done.state).toBe('judging')
      expect(prompts).toHaveLength(4)
      expect(prompts.every(p => p.prompt.includes('one of 4 candidates') && p.prompt.includes('without knowing which is which'))).toBe(true)
      expect(prompts.find(p => p.label === 'D')!.prompt).toContain('Style description: "像复古游戏机"')
      for (const [i, word] of ['CONSERVATIVE', 'MINIMAL', 'VIBRANT', 'CUSTOM'].entries()) {
        const candidate = done.candidates[i]!
        expect(candidate).toMatchObject({ stage: 'ready', preview: { kind: 'static' } })
        expect(await (await fetchPreview(candidate.preview!.url)).text()).toBe(`<h1>${word}</h1>`)
      }
      // Blind: nothing names a style before the pick, for any of the four.
      const blind = publicView(done)
      expect(blind.candidates).toHaveLength(4)
      expect(blind.candidates.every(x => x.strategy === undefined && x.summary === undefined)).toBe(true)
      expect(memoryNote(done)).toMatch(/All 4 candidates have finished/)
      expect(memoryNote(done)).toMatch(/do not choose for them or reveal styles/)
      expect(memoryNote(done)).not.toMatch(/Minimal|Vibrant/)

      const picked = await c.choose(started.runId, 'C')
      expect(publicView(picked).candidates[2]!.strategy?.title).toBe('活力 · Vibrant')
      expect(memoryNote(picked)).toMatch(/The user picked C \(strategy: 活力 · Vibrant/)
      // A revised pick can go to any other finished version.
      const revised = await c.choose(started.runId, 'D')
      expect(revised.choice).toMatchObject({ pick: 'D', initialPick: 'C' })
      const saved = await c.adopt(started.runId, 'folder')
      expect(await readFile(path.join(saved.adoption!.exportPath!, 'index.html'), 'utf8')).toBe('<h1>CUSTOM</h1>')
      await expect(c.choose(started.runId, 'A')).rejects.toThrow(/不能选择/)
    } finally { await c.dispose() }
  }, T)

  it('shows the styles of an open comparison from the start, in the chosen order, and adopts the third', async () => {
    const repo = await tmp('ac-multi-repo')
    await writeFile(path.join(repo, 'index.html'), '<h1>start</h1>')
    await git(repo, ['init', '-q', '-b', 'main'])
    await git(repo, ['config', 'user.email', 't@example.com'])
    await git(repo, ['config', 'user.name', 't'])
    await git(repo, ['config', 'core.autocrlf', 'false'])
    await git(repo, ['add', '-A'])
    await git(repo, ['commit', '-q', '-m', 'init'])
    const prompts: AgentRunRequest[] = []
    const c = await comparer(prompts)
    try {
      // No fixed assignment: an open comparison keeps the order the user chose.
      const started = await c.start({ repo, task: '改首页标题', candidates: 3, blind: false, strategies: styles({ id: 'rigorous' }, { id: 'polished' }, { id: 'lean' }) })
      expect(started.blind).toBe(false)
      expect(started.candidates.map(x => x.strategy.id)).toEqual(['rigorous', 'polished', 'lean'])
      const done = (await c.wait(started.runId))!
      // A static page has nothing to run, so a reply is also a valid result here.
      expect(prompts.every(p => p.prompt.includes('one of 3 candidates') && p.prompt.includes('all 3 results with the style each candidate was given shown beside it'))).toBe(true)
      const open = publicView(done)
      expect(done.state).toBe('judging')
      expect(open.candidates.map(x => x.strategy?.title)).toEqual(['严谨 · Rigorous', '精致 · Polished', '轻快 · Lean'])
      expect(open.candidates.every(x => x.patchStats !== undefined)).toBe(true)
      expect(memoryNote(done)).toMatch(/C \(轻快 · Lean\): passed the shared acceptance/)
      expect(memoryNote(done)).not.toMatch(/reveal styles/)

      await c.choose(started.runId, 'C')
      const adopted = await c.adopt(started.runId)
      expect(adopted.adoption).toMatchObject({ label: 'C', state: 'adopted' })
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>LEAN</h1>')
      await c.revert(started.runId)
      expect(await readFile(path.join(repo, 'index.html'), 'utf8')).toBe('<h1>start</h1>')
    } finally { await c.dispose() }
  }, T)

  it('assigns a blind comparison\'s styles to labels as a permutation of the chosen ones', async () => {
    const folder = await tmp('ac-multi-shuffle')
    const c = await comparer([])
    try {
      const chosen = ['conservative', 'bold', 'minimal', 'friendly']
      const started = await c.start({ repo: folder, task: '写一句欢迎语', candidates: 4, strategies: chosen.map(id => strategyFor({ id } as StyleChoice)) })
      expect(started.blind).toBeUndefined()
      expect(started.candidates.map(x => x.strategy.id).sort()).toEqual([...chosen].sort())
      await c.wait(started.runId)
      await c.choose(started.runId, 'none')
      expect(existsSync(folder)).toBe(true)
    } finally { await c.dispose() }
  }, T)

  it('refuses a count outside 2–4, mismatched styles and repeated models', async () => {
    const folder = await tmp('ac-multi-refuse')
    const c = await comparer([])
    try {
      await expect(c.start({ repo: folder, task: 'x', candidates: 5, strategies: styles({ id: 'bold' }, { id: 'bold' }, { id: 'bold' }, { id: 'bold' }, { id: 'bold' }) })).rejects.toThrow(/2 到 4/)
      await expect(c.start({ repo: folder, task: 'x', candidates: 3, strategies: styles({ id: 'bold' }, { id: 'lean' }) })).rejects.toThrow(/3 个版本各选一种风格/)
      await expect(c.start({ repo: folder, task: 'x', mode: 'cross-model', routes: [{ provider: 'p', model: 'm' }, { provider: 'p', model: 'm' }, { provider: 'q', model: 'n' }] })).rejects.toThrow(/互不相同/)
    } finally { await c.dispose() }
  }, T)
})
