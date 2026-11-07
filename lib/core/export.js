/**
 * Saving a picked version into a new folder, for comparisons that started
 * from a folder outside Git. Nothing existing is ever replaced: the folder is
 * created fresh, and undo removes only files whose bytes are unchanged.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, rmdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { git } from './git.js';
/** More files than this are not saved in one go; the branch-free copy remains in the record. */
export const MAX_EXPORT_FILES = 5_000;
const UNSAFE = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
/** A readable, unique folder name: the start of the task, then the run id. */
export function exportFolderName(task, runId) {
    const words = task.replace(UNSAFE, ' ').replace(/\s+/g, '-').replace(/^[-.\s]+|[-.\s]+$/g, '');
    const head = [...words].slice(0, 24).join('').replace(/[-.\s]+$/g, '');
    return `${head || 'agent-compare'}-${runId}`;
}
/** `base` when it is free, else `base-2`, `base-3`… in the same parent. */
export function freeFolder(parent, base) {
    for (let n = 1; n < 1000; n++) {
        const candidate = path.join(parent, n === 1 ? base : `${base}-${n}`);
        if (!existsSync(candidate))
            return candidate;
    }
    throw new Error('无法为保存结果找到可用的文件夹名称');
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
/**
 * Write every regular file of `tree` into the new folder `target` (which must
 * not exist yet). On any failure the files written so far are removed again.
 */
export async function exportTree(repo, tree, scratchDir, target) {
    const listing = await git(repo, ['ls-tree', '-r', '-z', '--full-tree', tree]);
    const entries = listing.split('\0').filter(Boolean).map(line => ({ mode: line.slice(0, 6), file: line.slice(line.indexOf('\t') + 1) }));
    const regular = entries.filter(entry => entry.mode === '100644' || entry.mode === '100755').map(entry => entry.file);
    const skipped = entries.filter(entry => entry.mode !== '100644' && entry.mode !== '100755').map(entry => entry.file);
    if (regular.length === 0)
        throw new Error('这一版没有可以保存的文件');
    if (regular.length > MAX_EXPORT_FILES)
        throw new Error(`这一版有 ${regular.length} 个文件，超过一次保存 ${MAX_EXPORT_FILES} 个的上限`);
    await mkdir(path.dirname(target), { recursive: true });
    // Not recursive: a folder that appeared in the meantime is refused, never merged into.
    await mkdir(target);
    await mkdir(scratchDir, { recursive: true });
    const index = path.join(scratchDir, `export-index-${randomBytes(6).toString('hex')}`);
    const env = { GIT_INDEX_FILE: index, GIT_WORK_TREE: target };
    try {
        await git(repo, ['read-tree', tree], env, undefined, { timeoutMs: 60_000 });
        await git(repo, ['checkout-index', '--force', '--stdin', '-z', `--prefix=${target.replace(/\\/g, '/')}/`], env, regular.join('\0') + '\0', { timeoutMs: 120_000 });
        const digests = {};
        for (const file of regular)
            digests[file] = sha256(await readFile(path.join(target, ...file.split('/'))));
        return { exportPath: target, written: regular, digests, skipped };
    }
    catch (error) {
        await rm(target, { recursive: true, force: true }).catch(() => { });
        throw error;
    }
    finally {
        await rm(index, { force: true }).catch(() => { });
    }
}
/**
 * Remove a saved folder's files, but only when none of them changed since they
 * were saved; otherwise nothing is removed and the changed paths are returned.
 * The folder itself is removed only when it ends up empty.
 */
export async function removeExport(exportPath, digests) {
    const changed = [];
    const present = [];
    for (const [file, digest] of Object.entries(digests)) {
        let bytes;
        try {
            bytes = await readFile(path.join(exportPath, ...file.split('/')));
        }
        catch (error) {
            if (error.code === 'ENOENT')
                continue;
            throw error;
        }
        if (sha256(bytes) === digest)
            present.push(file);
        else
            changed.push(file);
    }
    if (changed.length > 0)
        return { removed: [], changed, folderRemoved: false };
    for (const file of present)
        await unlink(path.join(exportPath, ...file.split('/')));
    // Remove emptied directories from the deepest up; anything the user added stays.
    const directories = new Set();
    for (const file of Object.keys(digests)) {
        const parts = file.split('/');
        for (let depth = parts.length - 1; depth > 0; depth--)
            directories.add(parts.slice(0, depth).join('/'));
    }
    for (const directory of [...directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
        await rmdir(path.join(exportPath, ...directory.split('/'))).catch(() => { });
    }
    await rmdir(exportPath).catch(() => { });
    return { removed: present, changed, folderRemoved: !existsSync(exportPath) };
}
