import { describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { git } from '../src/core/git.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'

describe('bound build output exclusions', () => {
  it('blocks adoption when a passing build changes tracked source inside dist', async () => {
    const repo = await fixtureRepo()
    await mkdir(path.join(repo, 'dist'), { recursive: true })
    await writeFile(path.join(repo, 'dist', 'source.txt'), 'sealed source\n')
    await git(repo, ['add', '-f', 'dist/source.txt'])
    const pkg = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'))
    pkg.scripts.build += ' && node after-build.cjs'
    await writeFile(path.join(repo, 'package.json'), JSON.stringify(pkg))
    await writeFile(path.join(repo, 'after-build.cjs'), "require('node:fs').writeFileSync('dist/source.txt', 'changed during verification\\n')\n")
    await git(repo, ['add', 'package.json', 'after-build.cjs'])
    await git(repo, ['commit', '-qm', 'Track source and build helper'])
    const runner: AgentRunner = { isolation: 'own-root', run: async request => {
      await writeFile(path.join(request.cwd, 'index.html'), `<h1>shop ${request.label}</h1>\n`)
      return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'scripted fixture' } }
    } }
    const comparer = new Comparer({ store: new RunStore(await tmp('ac-tracked-output')), runner, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false })
    const started = await comparer.start({ repo, task: 'update the shop', assignment: 'fixed' })
    try {
      const done = (await comparer.wait(started.runId))!
      for (const candidate of done.candidates) {
        expect(candidate.stage).toBe('ready')
        expect(candidate.checks?.every(check => check.outcome === 'passed')).toBe(true)
        expect(candidate.drift).toContain('dist/source.txt')
        expect(candidate.verdict?.eligible).toBe(false)
      }
      await comparer.choose(started.runId, 'A')
      await expect(comparer.adopt(started.runId)).rejects.toThrow(/未封存/)
      expect(await readFile(path.join(repo, 'dist', 'source.txt'), 'utf8')).toBe('sealed source\n')
    } finally { await comparer.cleanup(started.runId); await comparer.dispose() }
  }, 180_000)
})
