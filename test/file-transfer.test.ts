import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CandidateWriteError, targetState, undoAdoption, writeCandidate } from '../src/core/adopt.ts'
import { commitTree, git } from '../src/core/git.ts'
import { finishFileTransfer, loadFileTransfer, newFileTransferRef, prepareFileTransfer, publishTransferEntry, restoreFileTransfer } from '../src/core/file-transfer.ts'
import { tmp } from './fixture.ts'

const original = Buffer.from('original\r\n')
const candidate = Buffer.from('candidate\n')
const late = Buffer.from('new user edit\r\n\0untouched bytes')
const worker = fileURLToPath(new URL('./file-transfer-worker.mjs', import.meta.url))
const equals = (a: unknown, b: string): boolean => path.resolve(String(a)) === path.resolve(b)

afterEach(() => { vi.restoreAllMocks(); syncBuiltinESMExports() })

async function fixture(status = 'M', attributes = false) {
  const repo = await fs.realpath(await tmp('ac-transfer repo'))
  const scratch = await tmp('ac-transfer scratch')
  const target = path.join(repo, 'item.txt'), ref = newFileTransferRef()
  await git(repo, ['init', '-q', '-b', 'main'])
  await git(repo, ['config', 'user.email', 't@example.com'])
  await git(repo, ['config', 'user.name', 't'])
  await git(repo, ['config', 'core.autocrlf', 'false'])
  await fs.writeFile(path.join(repo, 'keep.txt'), 'untouched\n')
  if (attributes) await fs.writeFile(path.join(repo, '.gitattributes'), '*.txt text eol=crlf\n')
  if (status !== 'A') await fs.writeFile(target, original)
  await git(repo, ['add', '-A']); await git(repo, ['commit', '-q', '-m', 'base'])
  const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
  const staged = await git(repo, ['ls-files', '-s', '-z'])
  if (status === 'D') await fs.unlink(target)
  else await fs.writeFile(target, candidate)
  await git(repo, ['add', '-A'])
  const tree = (await git(repo, ['write-tree'])).trim()
  await git(repo, ['read-tree', 'HEAD'])
  if (status === 'A') await fs.unlink(target)
  else await fs.writeFile(target, original)
  const operations = [{ path: 'item.txt', status }]
  return { repo, scratch, target, tree, ref, operations, head, staged }
}

async function prepare(f: Awaited<ReturnType<typeof fixture>>) {
  return prepareFileTransfer(f.repo, f.tree, f.operations, f.ref)
}

function editAtRename(target: string, destinationDirectory: string, edit: () => Promise<void>) {
  const real = fs.rename
  let calls = 0
  vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
    if (equals(source, target) && String(destination).includes(`${path.sep}${destinationDirectory}${path.sep}`) && calls++ === 0) await edit()
    return real(source, destination)
  })
  syncBuiltinESMExports()
  return () => calls
}

describe('durable no-replace file handoff', () => {
  for (const status of ['M', 'D']) it(`retains the actual edit made immediately before ${status} capture`, async () => {
    const f = await fixture(status), transfer = await prepare(f)
    const calls = editAtRename(f.target, 'before', () => fs.writeFile(f.target, late))
    await expect(publishTransferEntry(transfer, 0)).rejects.toThrow('新编辑')
    expect(calls()).toBe(1)
    expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(late)
    expect(await restoreFileTransfer(f.repo, f.ref)).toEqual({ restored: ['item.txt'], conflicts: [] })
    expect(await fs.readFile(f.target)).toEqual(late)
    expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.staged)
  })

  it('never replaces a file created immediately before candidate publication', async () => {
    const f = await fixture('A'), transfer = await prepare(f), real = fs.link
    let calls = 0
    vi.spyOn(fs, 'link').mockImplementation(async (source, destination) => {
      if (equals(destination, f.target) && calls++ === 0) await fs.writeFile(f.target, late, { flag: 'wx' })
      return real(source, destination)
    })
    syncBuiltinESMExports()
    await expect(publishTransferEntry(transfer, 0)).rejects.toMatchObject({ code: 'EEXIST' })
    expect(calls).toBe(1)
    expect(await restoreFileTransfer(f.repo, f.ref)).toEqual({ restored: [], conflicts: ['item.txt'] })
    expect(await fs.readFile(f.target)).toEqual(late)
    expect(await fs.readFile(path.join(transfer.root, 'next', '0'))).toEqual(candidate)
  })

  for (const status of ['M', 'A']) it(`retains an edit made immediately before undo captures a ${status} result`, async () => {
    const f = await fixture(status), transfer = await prepare(f)
    await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer)
    const calls = editAtRename(f.target, 'undo', () => fs.writeFile(f.target, late))
    expect(await restoreFileTransfer(f.repo, f.ref)).toEqual({ restored: [], conflicts: ['item.txt'] })
    expect(calls()).toBe(1)
    expect(await fs.readFile(f.target)).toEqual(late)
    expect(await fs.readFile(path.join(transfer.root, 'undo', '0'))).toEqual(late)
    if (status === 'M') expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(original)
  })

  it('detects writes through an already-open original handle and restores their bytes', async () => {
    const f = await fixture(), transfer = await prepare(f)
    const handle = await fs.open(f.target, 'r+')
    try {
      await publishTransferEntry(transfer, 0)
      await handle.truncate(0); await handle.write(late, 0, late.length, 0); await handle.sync()
      await expect(finishFileTransfer(transfer)).rejects.toThrow('原始文件又发生了变化')
    } finally { await handle.close() }
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual([])
    expect(await fs.readFile(f.target)).toEqual(late)
    expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(late)
  })

  it('keeps a new file that appears at the final restore link and permits a later retry', async () => {
    const f = await fixture(), transfer = await prepare(f)
    await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer)
    const real = fs.link
    let inserted = false
    vi.spyOn(fs, 'link').mockImplementation(async (source, destination) => {
      if (equals(destination, f.target) && !inserted) { inserted = true; await fs.writeFile(f.target, late, { flag: 'wx' }) }
      return real(source, destination)
    })
    syncBuiltinESMExports()
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual(['item.txt'])
    expect(inserted).toBe(true)
    expect(await fs.readFile(f.target)).toEqual(late)
    expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(original)
    await fs.unlink(f.target)
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual([])
    expect(await fs.readFile(f.target)).toEqual(original)
  })

  it('restores an independent inode and keeps original bytes after subsequent editing', async () => {
    const f = await fixture(), transfer = await prepare(f)
    await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer)
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual([])
    await fs.writeFile(f.target, late)
    expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(original)
    expect(await fs.readFile(path.join(transfer.root, 'undo', '0'))).toEqual(candidate)
    expect(await git(f.repo, ['status', '--porcelain', '--untracked-files=all'])).not.toContain('.agent-compare-transfer-')
  })

  it.each(['capture', 'publish', 'undo'])('recovers in a fresh process after termination at the %s boundary', async mode => {
    const f = await fixture(), transfer = await prepare(f)
    if (mode === 'undo') { await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer) }
    const child = spawn(process.execPath, [worker, mode, f.repo, JSON.stringify(f.ref)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const exited = once(child, 'exit')
    let output = '', errors = ''
    child.stderr.on('data', chunk => { errors += String(chunk) })
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Capture worker timed out: ${errors}`)), 20_000)
        child.stdout.on('data', chunk => { output += String(chunk); if (output.includes('captured\n')) { clearTimeout(timer); resolve() } })
        child.once('error', error => { clearTimeout(timer); reject(error) })
        child.once('exit', () => { clearTimeout(timer); reject(new Error(`Capture worker exited early: ${errors}`)) })
      })
    } finally { child.kill('SIGKILL'); await exited }
    expect((await loadFileTransfer(f.repo, f.ref)).journal.entries[0]!.phase).toBe({ capture: 'capturing', publish: 'publishing', undo: 'undoing' }[mode])
    expect(await fs.readFile(path.join(transfer.root, 'before', '0'))).toEqual(original)
    const restart = spawn(process.execPath, [worker, 'restore', f.repo, JSON.stringify(f.ref)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let result = '', diagnostic = ''
    restart.stdout.on('data', chunk => { result += String(chunk) }); restart.stderr.on('data', chunk => { diagnostic += String(chunk) })
    expect((await once(restart, 'exit'))[0], diagnostic).toBe(0)
    expect(JSON.parse(result)).toEqual({ restored: ['item.txt'], conflicts: [] })
    expect(await fs.readFile(f.target)).toEqual(original)
    expect((await git(f.repo, ['rev-parse', 'HEAD'])).trim()).toBe(f.head)
    expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.staged)
  })

  it('restores a read-only original with its bytes and permissions intact', async () => {
    const f = await fixture()
    await fs.chmod(f.target, 0o444)
    const mode = (await fs.stat(f.target)).mode
    const transfer = await prepare(f)
    await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer)
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual([])
    expect(await fs.readFile(f.target)).toEqual(original)
    expect((await fs.stat(f.target)).mode).toBe(mode)
  })

  it('refuses a substituted owner or redirected transfer directory before touching files', async () => {
    const f = await fixture(), transfer = await prepare(f)
    await expect(loadFileTransfer(f.repo, { ...f.ref, token: '0'.repeat(32) })).rejects.toThrow('归属标记')
    const outside = await tmp('ac-unrelated')
    await fs.writeFile(path.join(outside, 'keep.txt'), late)
    await fs.rename(path.join(transfer.root, 'next'), path.join(transfer.root, 'saved-next'))
    await fs.symlink(outside, path.join(transfer.root, 'next'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(publishTransferEntry(transfer, 0)).rejects.toThrow('子目录')
    expect(await fs.readFile(f.target)).toEqual(original)
    expect(await fs.readFile(path.join(outside, 'keep.txt'))).toEqual(late)
  })

  it('refuses a malformed path in its durable journal', async () => {
    const f = await fixture(), transfer = await prepare(f)
    const journal = JSON.parse(await fs.readFile(path.join(transfer.root, 'journal.json'), 'utf8'))
    journal.entries[0].path = '../unrelated.txt'
    await fs.writeFile(path.join(transfer.root, 'journal.json'), JSON.stringify(journal))
    await expect(restoreFileTransfer(f.repo, f.ref)).rejects.toThrow('路径不能直接写回')
    expect(await fs.readFile(f.target)).toEqual(original)
  })

  it('refuses unsupported filesystems before moving any user file', async () => {
    const f = await fixture(), real = fs.link
    vi.spyOn(fs, 'link').mockImplementation(async (source, destination) => {
      if (String(source).endsWith('link-probe')) throw Object.assign(new Error('unsupported'), { code: 'ENOTSUP' })
      return real(source, destination)
    })
    syncBuiltinESMExports()
    await expect(prepare(f)).rejects.toThrow('文件系统不支持')
    expect(await fs.readFile(f.target)).toEqual(original)
    expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.staged)
  })

  it('honours checkout attributes while undo preserves exact raw original bytes', async () => {
    const f = await fixture('M', true), transfer = await prepare(f)
    await publishTransferEntry(transfer, 0); await finishFileTransfer(transfer)
    expect(await fs.readFile(f.target)).toEqual(Buffer.from('candidate\r\n'))
    expect((await restoreFileTransfer(f.repo, f.ref)).conflicts).toEqual([])
    expect(await fs.readFile(f.target)).toEqual(original)
  })

  it('propagates the last-boundary edit through adoption rollback without losing it', async () => {
    const f = await fixture(), expected = await targetState(f.repo, f.scratch, ['item.txt'])
    const commit = await commitTree(f.repo, f.tree, [f.head], 'candidate')
    const calls = editAtRename(f.target, 'before', () => fs.writeFile(f.target, late))
    let failure: unknown
    try { await writeCandidate(f.repo, commit, f.operations, { expected, scratchDir: f.scratch, transfer: f.ref }) } catch (error) { failure = error }
    expect(calls()).toBe(1)
    expect(failure).toBeInstanceOf(CandidateWriteError)
    expect((failure as CandidateWriteError).attemptedPaths).toEqual(['item.txt'])
    expect(await undoAdoption(f.repo, f.scratch, { preAdoptCommit: f.head, candidateCommit: commit, touched: ['item.txt'], transfer: f.ref })).toEqual({ restored: ['item.txt'], conflicts: [] })
    expect(await fs.readFile(f.target)).toEqual(late)
    expect((await git(f.repo, ['rev-parse', 'HEAD'])).trim()).toBe(f.head)
    expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.staged)
  })
})
