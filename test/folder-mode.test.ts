/**
 * Comparisons outside a Vite repository: a folder that is not in Git (both
 * versions start empty; an answer, a page or files is the result; the pick is
 * saved into a new subfolder and can be undone), and a non-Vite project in a
 * repository subfolder served by its own start script.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, publicView, type AgentRunner, type AgentRunRequest } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { git } from '../src/core/git.ts'
import { fetchPreview } from '../src/core/preview-url.ts'
import { memoryNote } from '../src/host/conversation.ts'
import { prepareFixtureProcess, tmp } from './fixture.ts'

type Behaviour = (dir: string, req: AgentRunRequest) => Promise<string>

function runner(behaviour: { A: Behaviour; B: Behaviour }, prompts: string[] = []): AgentRunner {
  return {
    isolation: 'own-root',
    async run(req) {
      prompts.push(req.prompt)
      const summary = await behaviour[req.label](req.cwd, req)
      return { stopReason: 'completed', summary, usage: { kind: 'unknown', reason: 'scripted' } }
    },
  }
}

async function compare(folder: string, behaviour: { A: Behaviour; B: Behaviour }, task: string) {
  const store = new RunStore(await tmp('ac-folder-home'))
  const prompts: string[] = []
  const comparer = new Comparer({ store, runner: runner(behaviour, prompts), version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, previewTimeoutMs: 60_000 })
  const started = await comparer.start({ repo: folder, task, assignment: 'fixed' })
  const done = (await comparer.wait(started.runId))!
  return { store, comparer, runId: started.runId, done, prompts }
}

const sameDir = (a: string, b: string): boolean => path.relative(a, b) === ''
const T = 300_000

describe('a folder outside Git', () => {
  it('compares an answer with a page, saves the pick into a new folder and undoes it', async () => {
    const folder = await tmp('ac-folder')
    await writeFile(path.join(folder, 'notes.txt'), 'mine\n')
    const { store, comparer, runId, done, prompts } = await compare(folder, {
      A: async () => '一一得一\n一二得二\n二二得四',
      B: async dir => {
        await writeFile(path.join(dir, 'index.html'), '<h1>口诀表</h1><link rel="stylesheet" href="style.css">')
        await writeFile(path.join(dir, 'style.css'), 'h1{color:purple}')
        return '做了一个口诀表页面'
      },
    }, '背一下乘法口诀表')
    try {
      expect(done.target).toEqual({ kind: 'folder', folder: path.resolve(folder) })
      expect(path.relative(await realpath(store.home), await realpath(done.baseline.repoRoot))).toBe(path.join('ws', runId))
      expect(prompts.every(prompt => prompt.includes('starts empty'))).toBe(true)
      expect(done.candidates[0]).toMatchObject({ stage: 'ready', result: 'answer' })
      expect(done.candidates[1]).toMatchObject({ stage: 'ready', preview: { kind: 'static' } })
      expect(done.candidates[1]!.result).toBeUndefined()
      // Before the pick: the answer is the result itself; strategies and summaries stay hidden.
      const blind = publicView(done)
      expect(blind.candidates[0]).toMatchObject({ result: 'answer', answer: expect.stringContaining('二二得四') })
      expect(blind.candidates[1]!.summary).toBeUndefined()
      expect(blind.candidates.every(c => c.strategy === undefined)).toBe(true)
      expect(await (await fetchPreview(done.candidates[1]!.preview!.url)).text()).toContain('口诀表')
      expect(memoryNote(done)).toMatch(/A: replied with an answer and wrote no files/)
      // Nothing in the user's folder changed.
      expect(await readdir(folder)).toEqual(['notes.txt'])

      await comparer.choose(runId, 'B')
      await expect(comparer.adopt(runId, 'worktree')).rejects.toThrow(/保存到当前目录/)
      const saved = await comparer.adopt(runId, 'folder')
      expect(saved.adoption).toMatchObject({ mode: 'folder', state: 'adopted' })
      const exportPath = saved.adoption!.exportPath!
      expect(sameDir(await realpath(path.dirname(exportPath)), await realpath(folder))).toBe(true)
      expect(path.basename(exportPath)).toBe(`背一下乘法口诀表-${runId}`)
      expect(await readFile(path.join(exportPath, 'index.html'), 'utf8')).toContain('口诀表')
      expect(await readFile(path.join(folder, 'notes.txt'), 'utf8')).toBe('mine\n')
      expect(memoryNote(saved)).toContain('saved into the new folder')

      const reverted = await comparer.revert(runId)
      expect(reverted).toMatchObject({ state: 'revealed', adoption: { state: 'reverted' } })
      expect(existsSync(exportPath)).toBe(false)

      // A saved file the user changed is never removed by undo.
      const again = await comparer.adopt(runId, 'folder')
      await writeFile(path.join(again.adoption!.exportPath!, 'index.html'), 'changed by me')
      await expect(comparer.revert(runId)).rejects.toThrow(/改过/)
      expect(await readFile(path.join(again.adoption!.exportPath!, 'index.html'), 'utf8')).toBe('changed by me')
    } finally { await comparer.dispose() }
  }, T)

  it('keeps the picked answer in the conversation note and has nothing to save', async () => {
    const folder = await tmp('ac-folder-answers')
    const { comparer, runId, done } = await compare(folder, { A: async () => '答案 A', B: async () => '答案 B' }, '什么是盲选？')
    try {
      expect(done.candidates.map(c => c.result)).toEqual(['answer', 'answer'])
      const picked = await comparer.choose(runId, 'B')
      expect(memoryNote(picked)).toMatch(/The picked answer:\n答案 B/)
      await expect(comparer.adopt(runId, 'folder')).rejects.toThrow(/只有回答/)
    } finally { await comparer.dispose() }
  }, T)

  it('shows written files without a page, readable before the pick', async () => {
    const folder = await tmp('ac-folder-files')
    const { comparer, runId, done } = await compare(folder, {
      A: async dir => { await writeFile(path.join(dir, 'tool.py'), 'print("hi")\n'); await writeFile(path.join(dir, 'README.md'), '# tool\n'); return 'wrote a script' },
      B: async dir => { await writeFile(path.join(dir, 'data.bin'), Buffer.from([0, 1, 2, 3, 0, 255])); return 'wrote data' },
    }, '写一个脚本')
    try {
      expect(done.candidates.map(c => c.result)).toEqual(['files', 'files'])
      expect(publicView(done).candidates[0]!.resultFiles).toEqual(['README.md', 'tool.py'])
      expect(await comparer.readResultFile(runId, 'A', 'tool.py')).toMatchObject({ text: 'print("hi")\n', binary: false })
      expect(await comparer.readResultFile(runId, 'B', 'data.bin')).toMatchObject({ binary: true, size: 6 })
      await expect(comparer.readResultFile(runId, 'A', '../outside.txt')).rejects.toThrow(/没有写这个文件/)
      // No page by design: no page-check warning and no process-constraint warning without processes.
      expect(done.candidates[0]!.verdict).toMatchObject({ eligible: true, warnings: [] })
    } finally { await comparer.dispose() }
  }, T)

  it('still fails a candidate that wrote nothing and said nothing', async () => {
    const folder = await tmp('ac-folder-silent')
    const { comparer, done } = await compare(folder, { A: async () => '', B: async () => '有回答' }, '随便做点什么')
    try {
      expect(done.candidates[0]).toMatchObject({ stage: 'failed', error: { stage: 'sealing', message: expect.stringContaining('没有改动任何文件') } })
      expect(done.candidates[1]).toMatchObject({ stage: 'ready', result: 'answer' })
    } finally { await comparer.dispose() }
  }, T)
})

describe('a non-Vite project in a repository subfolder', () => {
  it('serves it through its start script and adopts into the subfolder', async () => {
    const repo = await tmp('ac-subproject')
    const web = path.join(repo, 'apps', 'web')
    await mkdir(web, { recursive: true })
    await writeFile(path.join(web, 'package.json'), JSON.stringify({ name: 'web', private: true, scripts: { start: 'node server.cjs' } }))
    await writeFile(path.join(web, 'server.cjs'), `const fs = require('fs'), http = require('http')
http.createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end(fs.readFileSync('index.html')) })
  .listen(Number(process.env.PORT), process.env.HOST || '127.0.0.1')
`)
    await writeFile(path.join(web, 'index.html'), '<h1>web</h1>')
    await writeFile(path.join(repo, 'README.md'), '# monorepo\n')
    await git(repo, ['init', '-q', '-b', 'main'])
    await git(repo, ['config', 'user.email', 't@example.com'])
    await git(repo, ['config', 'user.name', 't'])
    await git(repo, ['config', 'core.autocrlf', 'false'])
    await git(repo, ['add', '-A'])
    await git(repo, ['commit', '-q', '-m', 'init'])
    const edit = (label: string): Behaviour => async dir => { await writeFile(path.join(dir, 'apps', 'web', 'index.html'), `<h1>web ${label}</h1>`); return `changed ${label}` }
    const { comparer, runId, done, prompts } = await compare(web, { A: edit('A'), B: edit('B') }, '改首页标题')
    try {
      expect(done.target).toBeUndefined()
      expect(done.baseline.projectPath).toBe('apps/web')
      expect(prompts[0]).toContain('`apps/web/`')
      for (const c of done.candidates) {
        expect(c).toMatchObject({ stage: 'ready', preview: { kind: 'script' } })
        expect(path.relative(c.dir!, c.preview!.cwd)).toBe(path.join('apps', 'web'))
        expect(await (await fetchPreview(c.preview!.url)).text()).toBe(`<h1>web ${c.label}</h1>`)
        // The lockfile written by the install is install output, not drift.
        expect(c.drift).toEqual([])
        expect(c.verdict?.eligible).toBe(true)
      }
      await comparer.choose(runId, 'A')
      const adopted = await comparer.adopt(runId)
      expect(adopted.adoption?.state).toBe('adopted')
      expect(await readFile(path.join(web, 'index.html'), 'utf8')).toBe('<h1>web A</h1>')
    } finally { await comparer.dispose() }
  }, T)
})
