/**
 * Saving a picked version into a new folder, for comparisons that started
 * from a folder outside Git. Nothing existing is ever replaced: the folder is
 * created fresh, and undo removes only files whose bytes are unchanged.
 */
import { createHash, randomBytes } from 'node:crypto'
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { constants, existsSync } from 'node:fs'
import path from 'node:path'
import { git } from './git.ts'
import { fileFingerprint } from './file-transfer.ts'

/** More files than this are not saved in one go; the branch-free copy remains in the record. */
export const MAX_EXPORT_FILES = 5_000

const UNSAFE = /[<>:"/\\|?*\u0000-\u001f\u007f]/g

/** A readable, unique folder name: the start of the task, then the run id. */
export function exportFolderName(task: string, runId: string): string {
  const words = task.replace(UNSAFE, ' ').replace(/\s+/g, '-').replace(/^[-.\s]+|[-.\s]+$/g, '')
  const head = [...words].slice(0, 24).join('').replace(/[-.\s]+$/g, '')
  return `${head || 'agent-compare'}-${runId}`
}

/** `base` when it is free, else `base-2`, `base-3`… in the same parent. */
export function freeFolder(parent: string, base: string): string {
  for (let n = 1; n < 1000; n++) {
    const candidate = path.join(parent, n === 1 ? base : `${base}-${n}`)
    if (!existsSync(candidate)) return candidate
  }
  throw new Error('无法为保存结果找到可用的文件夹名称')
}

export interface ExportResult {
  readonly exportPath: string
  readonly written: string[]
  /** Path inside the folder → SHA-256 of what was written. */
  readonly digests: Record<string, string>
  /** Links and other special entries that were not written as files. */
  readonly skipped: string[]
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

/** Refuse redirected parents before touching an exported path. */
async function ordinaryPath(root: string, file: string, create = false): Promise<string> {
  const parts = file.split('/')
  if (!file || parts.some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git') || file.includes('\\') || path.isAbsolute(file)) throw new Error('Invalid saved-file path')
  let current = root
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part)
    if (create) await mkdir(current).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error })
    const info = await lstat(current)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Saved-file parent was redirected')
  }
  const actual = await realpath(path.dirname(path.join(root, ...parts)))
  if (path.relative(path.dirname(path.join(root, ...parts)), actual) !== '') throw new Error('Saved-file parent was redirected')
  return path.join(root, ...parts)
}

/**
 * Write every regular file of `tree` into the new folder `target` (which must
 * not exist yet). Checkout happens privately; publication never replaces a
 * path. On failure, leave partial output for inspection instead of deleting
 * a directory another writer may already have edited.
 */
export async function exportTree(repo: string, tree: string, scratchDir: string, target: string): Promise<ExportResult> {
  const listing = await git(repo, ['ls-tree', '-r', '-z', '--full-tree', tree])
  const entries = listing.split('\0').filter(Boolean).map(line => ({ mode: line.slice(0, 6), file: line.slice(line.indexOf('\t') + 1) }))
  const regular = entries.filter(entry => entry.mode === '100644' || entry.mode === '100755').map(entry => entry.file)
  const skipped = entries.filter(entry => entry.mode !== '100644' && entry.mode !== '100755').map(entry => entry.file)
  if (regular.length === 0) throw new Error('这一版没有可以保存的文件')
  if (regular.length > MAX_EXPORT_FILES) throw new Error(`这一版有 ${regular.length} 个文件，超过一次保存 ${MAX_EXPORT_FILES} 个的上限`)
  await mkdir(path.dirname(target), { recursive: true })
  // Not recursive: a folder that appeared in the meantime is refused, never merged into.
  await mkdir(target)
  target = await realpath(target)
  await mkdir(scratchDir, { recursive: true })
  const checkout = await mkdtemp(path.join(scratchDir, 'export-checkout-'))
  const index = path.join(scratchDir, `export-index-${randomBytes(6).toString('hex')}`)
  const env = { GIT_INDEX_FILE: index, GIT_WORK_TREE: checkout }
  try {
    await git(repo, ['read-tree', tree], env, undefined, { timeoutMs: 60_000 })
    await git(repo, ['checkout-index', '--force', '--stdin', '-z', `--prefix=${checkout.replace(/\\/g, '/')}/`], env, regular.join('\0') + '\0', { timeoutMs: 120_000 })
    const digests: Record<string, string> = {}
    for (const file of regular) {
      const source = path.join(checkout, ...file.split('/'))
      const destination = await ordinaryPath(target, file, true)
      digests[file] = sha256(await readFile(source))
      await copyFile(source, destination, constants.COPYFILE_EXCL)
      if ((await fileFingerprint(destination)).sha256 !== digests[file]) throw new Error('Saved file changed during publication')
    }
    return { exportPath: target, written: regular, digests, skipped }
  } catch (error) {
    throw new Error(`Save did not complete; partial files were retained at ${target}`, { cause: error })
  } finally {
    await rm(index, { force: true }).catch(() => {})
    // Private checkout is retained with the run, including failure evidence.
  }
}

/**
 * Remove a saved folder's files, but only when none of them changed since they
 * were saved; otherwise nothing is removed and the changed paths are returned.
 * The folder itself is removed only when it ends up empty.
 */
export function exportUndoDirectory(exportPath: string): string {
  return path.join(path.dirname(exportPath), `.agent-compare-undo-${randomBytes(16).toString('hex')}`)
}

export async function removeExport(exportPath: string, digests: Readonly<Record<string, string>>, retainedDirectory: string): Promise<{ removed: string[]; changed: string[]; folderRemoved: boolean }> {
  const root = await realpath(exportPath).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error })
  if (!root) return { removed: [], changed: [], folderRemoved: true }
  if ((await lstat(exportPath)).isSymbolicLink() || path.relative(root, path.resolve(exportPath)) !== '') return { removed: [], changed: Object.keys(digests), folderRemoved: false }
  if (path.relative(path.dirname(root), path.dirname(retainedDirectory)) !== '' || !/^\.agent-compare-undo-[a-f0-9]{32}$/.test(path.basename(retainedDirectory))) throw new Error('Invalid undo retention directory')
  const changed: string[] = []
  const present: string[] = []
  for (const [file, digest] of Object.entries(digests)) {
    let fingerprint
    try { fingerprint = await fileFingerprint(await ordinaryPath(root, file)) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error }
    if (fingerprint.kind === 'missing') continue
    if (fingerprint.kind === 'file' && fingerprint.sha256 === digest) present.push(file)
    else changed.push(file)
  }
  if (changed.length > 0) return { removed: [], changed, folderRemoved: false }
  await mkdir(retainedDirectory, { mode: 0o700 })
  await writeFile(path.join(retainedDirectory, 'originals.json'), JSON.stringify({ schema: 'agent-compare.export-undo/v1', exportPath: root, files: present, digests }), { flag: 'wx', mode: 0o600 })
  const captured: Array<{ file: string; slot: string }> = []
  try {
    for (const [i, file] of present.entries()) {
      const target = await ordinaryPath(root, file), slot = path.join(retainedDirectory, String(i))
      await rename(target, slot)
      captured.push({ file, slot })
      if ((await fileFingerprint(slot)).sha256 !== digests[file]) { changed.push(file); break }
    }
  } catch (error) {
    changed.push(present[captured.length] ?? 'Saved-file transfer interrupted')
  }
  if (changed.length) {
    // No-replace restoration. Captured inodes remain retained even when an
    // editor holding an open handle writes after the content check.
    for (const { file, slot } of captured) {
      try { await link(slot, await ordinaryPath(root, file, true)) } catch { if (!changed.includes(file)) changed.push(file) }
    }
    return { removed: [], changed, folderRemoved: false }
  }
  // Remove emptied directories from the deepest up; anything the user added stays.
  const directories = new Set<string>()
  for (const file of Object.keys(digests)) {
    const parts = file.split('/')
    for (let depth = parts.length - 1; depth > 0; depth--) directories.add(parts.slice(0, depth).join('/'))
  }
  for (const directory of [...directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
    await rmdir(path.join(exportPath, ...directory.split('/'))).catch(() => {})
  }
  await rmdir(exportPath).catch(() => {})
  return { removed: present, changed, folderRemoved: !existsSync(exportPath) }
}
