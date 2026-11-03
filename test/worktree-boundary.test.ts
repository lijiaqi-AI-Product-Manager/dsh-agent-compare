import { describe, expect, it, vi } from 'vitest'
import { mkdir, open, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import * as proc from '../src/core/proc.ts'
import { addOwnedWorktree, captureChange, git, ownedCopyTree, ownedWorktreeAdmin, removeOwnedWorktree, snapshotTree } from '../src/core/git.ts'
import { tmp } from './fixture.ts'

async function replace(file: string, content: string): Promise<void> {
  const handle = await open(file, 'r+')
  try { await handle.truncate(0); await handle.writeFile(content) } finally { await handle.close() }
}

async function fixture() {
  const root = await tmp('ac-git-boundary'), repo = path.join(root, 'project'), dir = path.join(root, 'copy A'), sibling = path.join(root, 'copy B')
  await mkdir(repo)
  await git(repo, ['init', '-q', '-b', 'main'])
  await git(repo, ['config', 'user.name', 'Fixture']); await git(repo, ['config', 'user.email', 'fixture@example.invalid'])
  await writeFile(path.join(repo, 'page.txt'), 'original\n')
  await git(repo, ['add', '.']); await git(repo, ['commit', '-qm', 'Initial page'])
  const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
  const owner = { runId: '0a1b2c3d', label: 'A', token: 'controlled-copy-a' }
  await addOwnedWorktree(repo, dir, head, owner)
  await addOwnedWorktree(repo, sibling, head, { ...owner, label: 'B', token: 'controlled-copy-b' })
  const admin = await ownedWorktreeAdmin(repo, dir, owner)
  const siblingAdmin = (await git(sibling, ['rev-parse', '--absolute-git-dir'])).trim()
  const indexes = [path.join(repo, '.git/index'), path.join(siblingAdmin, 'index')]
  const before = await Promise.all(indexes.map(file => readFile(file)))
  const preserved = async () => { for (let i = 0; i < indexes.length; i++) expect(await readFile(indexes[i]!)).toEqual(before[i]) }
  await writeFile(path.join(dir, 'page.txt'), 'candidate\n')
  return { repo, dir, sibling, head, admin, siblingAdmin, owner, copy: { repo, owner }, indexes, preserved }
}

describe('candidate Git administration boundary', () => {
  it.each(['main', 'sibling'] as const)('rejects a pointer redirected to the %s index and retains the copy', async target => {
    const f = await fixture()
    await replace(path.join(f.dir, '.git'), `gitdir: ${target === 'main' ? path.join(f.repo, '.git') : f.siblingAdmin}\n`)
    await expect(captureChange(f.dir, f.head, 'Candidate', f.copy)).rejects.toThrow(/pointer/)
    expect(await removeOwnedWorktree(f.repo, f.dir, f.owner)).toMatchObject({ removed: false, reason: expect.stringContaining('pointer') })
    expect(await readFile(path.join(f.dir, 'page.txt'), 'utf8')).toBe('candidate\n')
    await f.preserved()
  })

  it('binds the first write even if the pointer changes after attestation', async () => {
    const f = await fixture(), original = proc.runOk
    let redirected = false
    const spy = vi.spyOn(proc, 'runOk').mockImplementation(async (argv, options) => {
      if (!redirected && argv.includes('--git-dir') && argv.includes('add')) {
        redirected = true
        await replace(path.join(f.dir, '.git'), `gitdir: ${path.join(f.repo, '.git')}\n`)
      }
      return original(argv, options)
    })
    try {
      await expect(ownedCopyTree(f.dir, f.copy)).rejects.toThrow(/pointer/)
      expect(redirected).toBe(true)
      await f.preserved()
      expect((await git(f.repo, ['--git-dir', f.admin, '--work-tree', f.dir, 'diff', '--cached', '--name-only'])).trim()).toBe('page.txt')
    } finally { spy.mockRestore() }
  })

  it.each(['missing', 'malformed', 'oversized', 'linked'] as const)('refuses %s pointer metadata before capture or cleanup', async kind => {
    const f = await fixture(), pointer = path.join(f.dir, '.git')
    if (kind === 'malformed') await replace(pointer, `gitdir: ${f.admin}\nextra line\n`)
    if (kind === 'oversized') await replace(pointer, 'x'.repeat(16 * 1024 + 1))
    if (kind === 'missing' || kind === 'linked') {
      await rm(pointer)
      if (kind === 'linked') await symlink(f.admin, pointer, process.platform === 'win32' ? 'junction' : 'dir')
    }
    await expect(ownedCopyTree(f.dir, f.copy)).rejects.toThrow()
    expect((await removeOwnedWorktree(f.repo, f.dir, f.owner)).removed).toBe(false)
    await f.preserved()
  })

  it.each(['owner', 'backlink', 'common'] as const)('does not accept a changed trusted %s record', async kind => {
    const f = await fixture()
    if (kind === 'owner') await writeFile(path.join(f.admin, 'agent-compare-owner.json'), JSON.stringify({ ...f.owner, token: 'different' }))
    if (kind === 'backlink') await writeFile(path.join(f.admin, 'gitdir'), path.join(f.sibling, '.git') + '\n')
    if (kind === 'common') await writeFile(path.join(f.admin, 'commondir'), f.siblingAdmin + '\n')
    await expect(ownedCopyTree(f.dir, f.copy)).rejects.toThrow(/owner|backlink|common/)
    await f.preserved()
  })

  it('ignores inherited repository, index and injected config selectors, while preserving deliberate private indexes', async () => {
    const f = await fixture()
    const poison = { GIT_DIR: f.siblingAdmin, GIT_WORK_TREE: f.sibling, GIT_INDEX_FILE: f.indexes[0]!, GIT_COMMON_DIR: path.join(f.repo, '.git'), GIT_NAMESPACE: 'foreign', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: f.sibling }
    for (const [key, value] of Object.entries(poison)) vi.stubEnv(key, value)
    try {
      expect(realpathSync.native((await git(f.repo, ['rev-parse', '--show-toplevel'])).trim())).toBe(realpathSync.native(f.repo))
      const change = await captureChange(f.dir, f.head, 'Candidate', f.copy)
      expect(change.touched).toEqual(['page.txt'])
      const scratch = await tmp('ac-private-index')
      expect(await snapshotTree(f.repo, scratch)).toBe((await git(f.repo, ['rev-parse', 'HEAD^{tree}'])).trim())
      await f.preserved()
    } finally { vi.unstubAllEnvs() }
  })
})
