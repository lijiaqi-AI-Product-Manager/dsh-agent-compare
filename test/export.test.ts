import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { exportTree, exportUndoDirectory, removeExport } from '../src/core/export.ts'
import { git } from '../src/core/git.ts'
import { tmp } from './fixture.ts'

afterEach(() => { vi.restoreAllMocks(); syncBuiltinESMExports() })
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const same = (a: unknown, b: string) => path.resolve(String(a)) === b

async function saved() {
  const parent = await fs.realpath(await tmp('ac-export'))
  const folder = path.join(parent, 'saved')
  await fs.mkdir(folder)
  await fs.writeFile(path.join(folder, 'a.txt'), 'A')
  await fs.writeFile(path.join(folder, 'b.txt'), 'B')
  return { folder, retained: exportUndoDirectory(folder), digests: { 'a.txt': digest('A'), 'b.txt': digest('B') } }
}

describe('folder export ownership', () => {
  it('retains originals on undo and leaves new files in the saved folder', async () => {
    const { folder, retained, digests } = await saved()
    await fs.writeFile(path.join(folder, 'mine.txt'), 'new file')
    expect(await removeExport(folder, digests, retained)).toEqual({ removed: ['a.txt', 'b.txt'], changed: [], folderRemoved: false })
    expect(await fs.readdir(folder)).toEqual(['mine.txt'])
    expect(await fs.readFile(path.join(retained, '0'), 'utf8')).toBe('A')
    expect(JSON.parse(await fs.readFile(path.join(retained, 'originals.json'), 'utf8')).files).toEqual(['a.txt', 'b.txt'])
  })

  it('refuses the whole undo when an existing saved file changed', async () => {
    const { folder, retained, digests } = await saved()
    await fs.writeFile(path.join(folder, 'b.txt'), 'my edit')
    expect(await removeExport(folder, digests, retained)).toEqual({ removed: [], changed: ['b.txt'], folderRemoved: false })
    expect(await fs.readFile(path.join(folder, 'a.txt'), 'utf8')).toBe('A')
    expect(existsSync(retained)).toBe(false)
  })

  it('captures and restores an edit made immediately before the file moves', async () => {
    const { folder, retained, digests } = await saved()
    const rename = fs.rename
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (same(from, path.join(folder, 'b.txt'))) await fs.writeFile(from, 'late edit')
      return rename(from, to)
    })
    syncBuiltinESMExports()
    expect((await removeExport(folder, digests, retained)).changed).toContain('b.txt')
    expect(await fs.readFile(path.join(folder, 'a.txt'), 'utf8')).toBe('A')
    expect(await fs.readFile(path.join(folder, 'b.txt'), 'utf8')).toBe('late edit')
    expect(await fs.readFile(path.join(retained, '1'), 'utf8')).toBe('late edit')
  })

  it('preserves both files when another writer recreates the path during undo', async () => {
    const { folder, retained, digests } = await saved()
    const rename = fs.rename
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (same(from, path.join(folder, 'a.txt'))) {
        await fs.writeFile(from, 'late edit')
        await rename(from, to)
        await fs.writeFile(from, 'new current file')
      } else await rename(from, to)
    })
    syncBuiltinESMExports()
    expect((await removeExport(folder, digests, retained)).changed).toContain('a.txt')
    expect(await fs.readFile(path.join(folder, 'a.txt'), 'utf8')).toBe('new current file')
    expect(await fs.readFile(path.join(retained, '0'), 'utf8')).toBe('late edit')
    expect(await fs.readFile(path.join(folder, 'b.txt'), 'utf8')).toBe('B')
  })

  it('refuses a redirected parent without touching its files', async () => {
    const { folder, retained } = await saved()
    const outside = await fs.realpath(await tmp('ac-export-outside'))
    await fs.writeFile(path.join(outside, 'item.txt'), 'outside')
    await fs.symlink(outside, path.join(folder, 'sub'), 'junction')
    await expect(removeExport(folder, { 'sub/item.txt': digest('outside') }, retained)).rejects.toThrow(/redirected/)
    expect(await fs.readFile(path.join(outside, 'item.txt'), 'utf8')).toBe('outside')
  })

  it('never replaces a file created during save, and retains partial output on failure', async () => {
    const repo = await fs.realpath(await tmp('ac-export-source'))
    await git(repo, ['init', '-q'])
    await fs.writeFile(path.join(repo, 'a.txt'), 'A')
    await fs.writeFile(path.join(repo, 'b.txt'), 'B')
    await git(repo, ['add', '-A'])
    const tree = (await git(repo, ['write-tree'])).trim()
    const target = path.join(await fs.realpath(await tmp('ac-export-target')), 'result')
    const copy = fs.copyFile
    vi.spyOn(fs, 'copyFile').mockImplementation(async (from, to, mode) => {
      if (same(to, path.join(target, 'b.txt'))) await fs.writeFile(to, 'new user file')
      return copy(from, to, mode)
    })
    syncBuiltinESMExports()
    await expect(exportTree(repo, tree, await tmp('ac-export-scratch'), target)).rejects.toThrow(/partial files were retained/)
    expect(await fs.readFile(path.join(target, 'a.txt'), 'utf8')).toBe('A')
    expect(await fs.readFile(path.join(target, 'b.txt'), 'utf8')).toBe('new user file')
  })
})
