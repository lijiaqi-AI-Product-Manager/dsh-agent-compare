import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { addOwnedWorktree, git, registeredWorktrees, removeOwnedWorktree } from '../src/core/git.ts'
import { run } from '../src/core/proc.ts'
import { fixtureRepo, tmp } from './fixture.ts'

describe('worktree administration concurrency', () => {
  it('preserves all owners across repeated concurrent add and remove operations', async () => {
    const repo = await fixtureRepo()
    const home = await tmp('ac-parallel-worktrees')
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const entries = Array.from({ length: 8 }, (_, i) => ({ dir: path.join(home, `copy-${i}`), owner: { runId: `run-${i}`, label: `C${i}`, token: `owner-${i}` } }))
    const canonical = (p: string) => {
      const resolved = realpathSync.native(p)
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved
    }
    try {
      await Promise.all(entries.map(e => addOwnedWorktree(repo, e.dir, head, e.owner)))
      const registered = await registeredWorktrees(repo)
      for (const entry of entries) {
        expect(registered.map(canonical)).toContain(canonical(entry.dir))
        const admin = path.resolve(entry.dir, (await git(entry.dir, ['rev-parse', '--git-dir'])).trim())
        expect(JSON.parse(await readFile(path.join(admin, 'agent-compare-owner.json'), 'utf8'))).toEqual(entry.owner)
      }
      const foreign = await removeOwnedWorktree(repo, entries[0]!.dir, { ...entries[0]!.owner, token: 'different-owner' })
      expect(foreign.removed).toBe(false)
    } finally {
      const results = await Promise.all(entries.map(e => removeOwnedWorktree(repo, e.dir, e.owner)))
      expect(results.every(result => result.removed)).toBe(true)
    }
    expect(await registeredWorktrees(repo)).toHaveLength(1)
  }, 90_000)

  it('coordinates simultaneous add and prune operations from separate processes', async () => {
    const repo = await fixtureRepo()
    const home = await tmp('ac-process-worktrees')
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const module = pathToFileURL(path.resolve('lib/core/git.js')).href
    const entries = Array.from({ length: 4 }, (_, i) => ({ dir: path.join(home, `child-${i}`), owner: { runId: `child-${i}`, label: `C${i}`, token: `child-owner-${i}` } }))
    const worker = `import {addOwnedWorktree,removeOwnedWorktree} from ${JSON.stringify(module)};
const [action,repo,dir,head,owner]=process.argv.slice(1); const mark=JSON.parse(owner);
if(action==='add')await addOwnedWorktree(repo,dir,head,mark);
else if(!(await removeOwnedWorktree(repo,dir,mark)).removed)throw new Error('owned copy was retained');`
    const execute = async (action: string, entry: typeof entries[number]) => {
      const result = await run(['node', '--input-type=module', '-e', worker, action, repo, entry.dir, head, JSON.stringify(entry.owner)], { cwd: repo, timeoutMs: 75_000 })
      expect(result.code, result.stderr).toBe(0)
    }
    try {
      await Promise.all(entries.map(e => execute('add', e)))
      expect(await registeredWorktrees(repo)).toHaveLength(entries.length + 1)
    } finally { await Promise.all(entries.map(e => execute('remove', e))) }
    expect(await registeredWorktrees(repo)).toHaveLength(1)
  }, 120_000)
})
