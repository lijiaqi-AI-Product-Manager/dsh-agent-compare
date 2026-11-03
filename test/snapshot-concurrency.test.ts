import { describe, expect, it, vi } from 'vitest'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { git, overlayTree, readBlob, snapshotTree } from '../src/core/git.ts'
import * as processes from '../src/core/proc.ts'
import { fixtureRepo, tmp } from './fixture.ts'

describe('concurrent working-tree snapshots', () => {
  it('keeps simultaneous adoption overlays separate even within one clock tick', async () => {
    const repo = await fixtureRepo(), scratch = await tmp('ac-overlapping-overlays')
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const staged = await git(repo, ['ls-files', '-s'])
    const base = await snapshotTree(repo, scratch)
    await writeFile(path.join(repo, 'new.txt'), 'candidate A\n')
    const a = await snapshotTree(repo, scratch)
    await writeFile(path.join(repo, 'new.txt'), 'candidate B\n')
    const b = await snapshotTree(repo, scratch)
    await writeFile(path.join(repo, 'new.txt'), 'current user edit\n')
    const originalRun = processes.runOk
    let arrivals = 0, release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const timer = setTimeout(release, 5000)
    const command = vi.spyOn(processes, 'runOk').mockImplementation(async (argv, options) => {
      if (argv[0] === 'git' && argv[1] === 'read-tree' && options.env?.GIT_INDEX_FILE) {
        if (++arrivals === 4) release()
        await barrier
      }
      return originalRun(argv, options)
    })
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    let results: PromiseSettledResult<string>[]
    try { results = await Promise.allSettled([a, b, a, b].map(source => overlayTree(repo, scratch, base, source, [{ status: 'A', path: 'new.txt' }]))) }
    finally { release(); clearTimeout(timer); command.mockRestore(); clock.mockRestore() }
    expect(results.filter(r => r.status === 'rejected')).toEqual([])
    const trees = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
    expect(trees).toEqual([a, b, a, b])
    expect((await git(repo, ['rev-parse', 'HEAD'])).trim()).toBe(head)
    expect(await git(repo, ['ls-files', '-s'])).toBe(staged)
    expect(await readdir(scratch)).toEqual([])
  }, 60_000)

  it('keeps snapshots independent within one clock tick and preserves the user index', async () => {
    const repo = await fixtureRepo(), scratch = await tmp('ac-overlapping-snapshots')
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    const staged = await git(repo, ['ls-files', '-s'])
    await writeFile(path.join(repo, 'new.txt'), 'keep the complete snapshot\n')
    const originalRun = processes.runOk
    let arrivals = 0, release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const timer = setTimeout(release, 1000)
    const command = vi.spyOn(processes, 'runOk').mockImplementation(async (argv, options) => {
      if (argv[0] === 'git' && argv[1] === 'add' && options.env?.GIT_INDEX_FILE) {
        if (++arrivals === 4) release()
        await barrier
      }
      return originalRun(argv, options)
    })
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    let results: PromiseSettledResult<string>[]
    try { results = await Promise.allSettled(Array.from({ length: 4 }, () => snapshotTree(repo, scratch))) }
    finally { release(); clearTimeout(timer); command.mockRestore(); clock.mockRestore() }
    const failures = results.filter(r => r.status === 'rejected').map(r => String(r.reason))
    expect(failures).toEqual([])
    const trees = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
    expect(new Set(trees).size).toBe(1)
    expect(await readBlob(repo, trees[0]!, 'new.txt')).toBe('keep the complete snapshot\n')
    expect((await git(repo, ['rev-parse', 'HEAD'])).trim()).toBe(head)
    expect(await git(repo, ['ls-files', '-s'])).toBe(staged)
    expect(await readdir(scratch)).toEqual([])
  }, 60_000)
})
