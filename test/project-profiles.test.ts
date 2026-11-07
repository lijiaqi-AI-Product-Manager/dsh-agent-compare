import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { defaultChecks, inspectProject, profileProject, projectRelative, staticEntry } from '../src/core/project.ts'
import { candidatePrompt, DEFAULT_STRATEGIES } from '../src/core/strategies.ts'

async function folder(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ac-profile-'))
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true })
    await writeFile(path.join(dir, file), content)
  }
  return dir
}
const manifest = (value: object): string => JSON.stringify(value)

describe('project profiles', () => {
  it('recognises every kind of directory instead of refusing it', async () => {
    expect(await profileProject(await folder({ 'package.json': manifest({ devDependencies: { vite: '^8.0.0' } }) }))).toMatchObject({ profile: 'vite' })
    expect(await profileProject(await folder({ 'package.json': manifest({ scripts: { dev: 'next dev' }, dependencies: { next: '15.0.0' } }) }))).toMatchObject({ profile: 'node-web', script: 'dev' })
    expect(await profileProject(await folder({ 'package.json': manifest({ scripts: { start: 'node server.cjs' } }) }))).toMatchObject({ profile: 'node-web', script: 'start' })
    expect(await profileProject(await folder({ 'package.json': manifest({ scripts: { test: 'node t.cjs' } }), 'index.html': '<h1>x</h1>' }))).toMatchObject({ profile: 'static', entry: 'index.html', info: { node: true } })
    expect(await profileProject(await folder({ 'package.json': manifest({ scripts: { test: 'node t.cjs' } }) }))).toMatchObject({ profile: 'node' })
    expect(await profileProject(await folder({ 'index.html': '<h1>x</h1>' }))).toMatchObject({ profile: 'static', entry: 'index.html' })
    expect(await profileProject(await folder({ 'main.py': 'print(1)\n' }))).toMatchObject({ profile: 'files' })
    expect(await profileProject(await folder({}))).toMatchObject({ profile: 'files' })
  })

  it('keeps an unusable package.json from blocking the comparison and says why', async () => {
    const broken = await profileProject(await folder({ 'package.json': '{ not json', 'index.html': '<p>page</p>' }))
    expect(broken).toMatchObject({ profile: 'static', note: expect.stringMatching(/package.json/) })
    const ambiguous = await profileProject(await folder({ 'package.json': manifest({ scripts: { dev: 'x' } }), 'package-lock.json': '{}', 'yarn.lock': '' }))
    expect(ambiguous).toMatchObject({ profile: 'files', note: expect.stringMatching(/多个/) })
  })

  it('opens a static site from index.html, or its first page', async () => {
    expect(await staticEntry(await folder({ 'b.html': '', 'index.html': '' }))).toBe('index.html')
    expect(await staticEntry(await folder({ 'calculator.html': '', 'about.htm': '' }))).toBe('about.htm')
    expect(await staticEntry(await folder({ 'notes.txt': '' }))).toBeUndefined()
  })

  it('derives shared commands only where the baseline can run them', async () => {
    expect(defaultChecks(await inspectProject(await folder({ 'main.py': '' }))).commands).toEqual([])
    const node = await inspectProject(await folder({ 'package.json': manifest({ scripts: { test: 'node t.cjs', build: 'node b.cjs', start: 'node s.cjs' } }) }))
    expect(defaultChecks(node).commands.map(c => c.name)).toEqual(['test', 'build'])
    expect(defaultChecks(await inspectProject(await folder({ 'package.json': manifest({ scripts: { start: 'node s.cjs' } }) }))).commands).toEqual([])
    // Vite alone keeps its build fallback.
    const vite = await inspectProject(await folder({ 'package.json': manifest({ devDependencies: { vite: '^8.0.0' } }) }))
    expect(defaultChecks(vite).commands.map(c => c.name)).toEqual(['build'])
  })

  it('maps repository paths into a project subfolder', () => {
    expect(projectRelative(undefined, 'src/App.tsx')).toBe('src/App.tsx')
    expect(projectRelative('apps/web', 'apps/web/src/App.tsx')).toBe('src/App.tsx')
    expect(projectRelative('apps/web', 'apps/webx/index.html')).toBeUndefined()
    expect(projectRelative('apps/web', 'README.md')).toBeUndefined()
  })
})

describe('candidate prompts by workspace', () => {
  const [conservative, bold] = DEFAULT_STRATEGIES

  it('starts a folder request from an empty directory and allows a plain answer', () => {
    const prompt = candidatePrompt('背一下乘法口诀表', conservative, 'own-root', undefined, { kind: 'folder' })
    expect(prompt).toContain('Request:\n背一下乘法口诀表')
    expect(prompt).toContain('starts empty')
    expect(prompt).toContain('reply with the complete answer and create no files')
    expect(prompt).toContain('index.html')
    expect(prompt).toContain('Do not mention which strategy')
    expect(prompt).not.toContain('frozen installation')
    expect(prompt).not.toContain('components, styles and patterns that already exist')
    expect(candidatePrompt('x', bold, 'own-root', undefined, { kind: 'folder' })).toContain('Strategy: BOLD')
  })

  it('names the project subfolder and allows answers only where nothing runs', () => {
    const sub = candidatePrompt('改按钮', conservative, 'own-root', undefined, { kind: 'repository', projectPath: 'apps/web' })
    expect(sub).toContain('`apps/web/`')
    expect(sub).not.toContain('only asks for an answer')
    const answers = candidatePrompt('解释一下', conservative, 'own-root', undefined, { kind: 'repository', answers: true })
    expect(answers).toContain('only asks for an answer')
    // The default is the long-standing repository prompt.
    expect(candidatePrompt('改按钮', conservative, 'own-root')).toContain('You are implementing one candidate for a side-by-side comparison')
  })
})
