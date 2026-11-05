import { describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { addOwnedWorktree, captureChange, git } from '../src/core/git.ts'
import { fixtureRepo, tmp } from './fixture.ts'

describe('dependency runtime and source separation', () => {
  it('does not let a staged generated loader replace the baseline loader', async () => {
    const repo = await fixtureRepo()
    await writeFile(path.join(repo, '.pnp.cjs'), 'baseline loader\n')
    await git(repo, ['add', '.pnp.cjs']); await git(repo, ['commit', '-qm', 'loader baseline'])
    const base = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const dir = path.join(await tmp('ac-yarn-source'), 'copy')
    const owner = { runId: 'aabbccdd', label: 'A', token: 'fixture-owner' }
    await addOwnedWorktree(repo, dir, base, owner)
    await writeFile(path.join(dir, '.pnp.cjs'), 'changed runtime loader\n')
    await writeFile(path.join(dir, '.pnp.data.json'), '{"runtime":"generated"}')
    await writeFile(path.join(dir, 'index.html'), '<h1>candidate</h1>\n')
    await git(dir, ['add', '-A'])
    const change = await captureChange(dir, base, 'candidate', { repo, owner, yarnModern: true })
    expect(change.touched).toEqual(['index.html'])
    expect(await git(repo, ['show', `${change.tree}:.pnp.cjs`])).toBe('baseline loader\n')
    expect(await readFile(path.join(repo, '.pnp.cjs'), 'utf8')).toBe('baseline loader\n')
  })
  it('keeps an ordinary loader-shaped source file for npm but excludes staged dependencies', async () => {
    const repo = await fixtureRepo(), base = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const dir = path.join(await tmp('ac-dependency-source'), 'copy')
    const owner = { runId: '11223344', label: 'A', token: 'fixture-owner' }
    await addOwnedWorktree(repo, dir, base, owner)
    await mkdir(path.join(dir, 'node_modules'), { recursive: true })
    await writeFile(path.join(dir, 'node_modules', 'injected.js'), 'runtime\n')
    await writeFile(path.join(dir, '.pnp.cjs'), 'ordinary project source\n')
    await git(dir, ['add', '-f', 'node_modules/injected.js', '.pnp.cjs'])
    const change = await captureChange(dir, base, 'candidate', { repo, owner })
    expect(change.touched).toEqual(['.pnp.cjs'])
    expect(change.patch).not.toContain('injected.js')
  })
})
