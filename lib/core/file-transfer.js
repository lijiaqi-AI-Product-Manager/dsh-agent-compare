import { constants } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, copyFile, link, lstat, mkdir, open, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { git } from './git.js';
const MAX_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const JOURNAL_BYTES = 8 * 1024 * 1024;
const MISSING = { kind: 'missing' };
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const errno = (error, code) => error.code === code;
const slot = (transfer, kind, index) => path.join(transfer.root, kind, String(index));
export class FileTransferError extends Error {
    paths;
    constructor(message, paths = []) {
        super(message);
        this.paths = paths;
        this.name = 'FileTransferError';
    }
}
export function newFileTransferRef() {
    return { id: randomBytes(16).toString('hex'), token: randomBytes(16).toString('hex') };
}
function validRef(ref) {
    if (!ref || !/^[0-9a-f]{32}$/.test(ref.id) || !/^[0-9a-f]{32}$/.test(ref.token))
        throw new FileTransferError('文件交接记录的标识无效');
}
function validPath(relative) {
    const parts = relative.split('/');
    if (!relative || relative.includes('\\') || relative.includes('\0') || path.posix.isAbsolute(relative)
        || parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git' || part.startsWith('.agent-compare-transfer-'))
        || (process.platform === 'win32' && parts.some(part => /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)))) {
        throw new FileTransferError('这个路径不能直接写回，请另存分支查看', [relative]);
    }
}
async function statIfPresent(file) {
    try {
        return await lstat(file);
    }
    catch (error) {
        if (errno(error, 'ENOENT'))
            return undefined;
        throw error;
    }
}
/** Hash a stable ordinary file without following a substituted symbolic link. */
export async function fileFingerprint(file) {
    const initial = await lstat(file, { bigint: true }).catch(error => { if (errno(error, 'ENOENT'))
        return undefined; throw error; });
    if (!initial)
        return MISSING;
    if (!initial.isFile() || initial.isSymbolicLink())
        return { kind: 'other' };
    if (initial.size > BigInt(MAX_BYTES))
        throw new FileTransferError('单个文件超过直接写回的保留上限，请另存分支');
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || String(before.ino) !== String(initial.ino) || String(before.dev) !== String(initial.dev))
            throw new FileTransferError('读取文件时路径发生变化');
        const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(256 * 1024);
        let position = 0;
        while (true) {
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
            if (!bytesRead)
                break;
            position += bytesRead;
            if (position > MAX_BYTES)
                throw new FileTransferError('读取期间文件超过直接写回的保留上限');
            hash.update(buffer.subarray(0, bytesRead));
        }
        const after = await handle.stat({ bigint: true }), current = await lstat(file, { bigint: true });
        if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs
            || after.ino !== current.ino || after.dev !== current.dev || after.mtimeNs !== current.mtimeNs)
            throw new FileTransferError('读取期间文件发生变化，请重新检查后再试');
        return { kind: 'file', sha256: hash.digest('hex'), size: Number(after.size), mode: Number(after.mode), device: String(after.dev), inode: String(after.ino), modified: String(after.mtimeNs) };
    }
    finally {
        await handle.close();
    }
}
export function sameFile(a, b, identity = true) {
    if (a.kind !== b.kind)
        return false;
    if (a.kind === 'missing')
        return true;
    if (a.kind !== 'file')
        return false;
    return a.sha256 === b.sha256 && a.size === b.size && a.mode === b.mode
        && (!identity || (a.device === b.device && a.inode === b.inode));
}
export async function transferPreimages(repo, paths) {
    const result = Object.create(null);
    for (const relative of paths) {
        validPath(relative);
        result[relative] = await fileFingerprint(path.join(repo, relative));
    }
    return result;
}
async function ordinaryParents(repo, relative, create) {
    validPath(relative);
    let current = repo;
    for (const part of relative.split('/').slice(0, -1)) {
        current = path.join(current, part);
        if (create)
            await mkdir(current).catch(error => { if (!errno(error, 'EEXIST'))
                throw error; });
        const stat = await statIfPresent(current);
        if (!stat && !create)
            return;
        if (!stat?.isDirectory() || stat.isSymbolicLink())
            throw new FileTransferError('目标的父路径不是普通目录，请另存分支查看', [relative]);
        if (!equalPath(await realpath(current), current))
            throw new FileTransferError('目标父目录发生了重定向', [relative]);
    }
}
async function boundedJson(file, limit) {
    const stat = await lstat(file, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > BigInt(limit))
        throw new FileTransferError('文件交接元数据不是有界的普通文件');
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat({ bigint: true });
        if (opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > BigInt(limit))
            throw new FileTransferError('文件交接元数据发生变化');
        const buffer = Buffer.alloc(limit + 1);
        let length = 0;
        while (length < buffer.length) {
            const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
            if (!bytesRead)
                break;
            length += bytesRead;
        }
        if (length > limit)
            throw new FileTransferError('文件交接元数据超过读取上限');
        return JSON.parse(buffer.subarray(0, length).toString('utf8'));
    }
    finally {
        await handle.close();
    }
}
async function assertOwner(transfer) {
    const { repo, ref } = transfer.journal;
    validRef(ref);
    const stat = await lstat(transfer.root);
    if (!equalPath(transfer.root, path.join(repo, `.agent-compare-transfer-${ref.id}`))
        || !stat.isDirectory() || stat.isSymbolicLink() || !equalPath(await realpath(transfer.root), transfer.root)
        || !equalPath(await realpath(repo), repo))
        throw new FileTransferError('文件交接目录的归属无法确认');
    const owner = await boundedJson(path.join(transfer.root, 'owner.json'), 4096);
    if (owner.schema !== 'agent-compare.file-transfer/v1' || owner.repo !== repo || owner.id !== ref.id || owner.token !== ref.token)
        throw new FileTransferError('文件交接目录的归属标记不匹配');
    for (const directory of ['next', 'before', 'undo', 'checkout', 'restore']) {
        const file = path.join(transfer.root, directory), child = await lstat(file);
        if (!child.isDirectory() || child.isSymbolicLink() || !equalPath(await realpath(file), file))
            throw new FileTransferError('文件交接子目录被替换或重定向');
    }
}
async function syncDirectory(directory) {
    try {
        const handle = await open(directory, 'r');
        try {
            await handle.sync();
        }
        finally {
            await handle.close();
        }
    }
    catch (error) {
        if (process.platform !== 'win32' || !['EACCES', 'EPERM', 'EINVAL', 'EISDIR', 'EBADF'].includes(error.code ?? ''))
            throw error;
    }
}
/** Restore through a fresh inode, retaining the captured original independently of future edits. */
async function restoreCopy(transfer, source, target) {
    await assertOwner(transfer);
    const before = await fileFingerprint(source);
    if (before.kind !== 'file')
        throw new FileTransferError('保留内容不是可自动恢复的普通文件');
    const prepared = path.join(transfer.root, 'restore', randomBytes(16).toString('hex'));
    await copyFile(source, prepared, constants.COPYFILE_EXCL);
    if ((before.mode & 0o200) === 0)
        await chmod(prepared, (before.mode & 0o777) | 0o200);
    const handle = await open(prepared, 'r+');
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    if ((before.mode & 0o200) === 0)
        await chmod(prepared, before.mode & 0o777);
    if (!sameFile(before, await fileFingerprint(source)) || !sameFile(before, await fileFingerprint(prepared), false))
        throw new FileTransferError('复制保留内容时又出现了编辑，请重试恢复');
    await link(prepared, target);
    await syncDirectory(path.dirname(target));
}
async function save(transfer) {
    await assertOwner(transfer);
    const bytes = JSON.stringify(transfer.journal);
    if (Buffer.byteLength(bytes) > JOURNAL_BYTES)
        throw new FileTransferError('文件交接记录过大，请另存分支');
    const temporary = path.join(transfer.root, `.journal-${randomBytes(8).toString('hex')}`);
    const handle = await open(temporary, 'wx', 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
    }
    finally {
        await handle.close();
    }
    await rename(temporary, path.join(transfer.root, 'journal.json'));
    await syncDirectory(transfer.root);
}
function validFingerprint(value) {
    if (!value || typeof value !== 'object')
        return false;
    const fp = value;
    return fp.kind === 'missing' || fp.kind === 'other' || (fp.kind === 'file' && /^[0-9a-f]{64}$/.test(fp.sha256 ?? '')
        && Number.isSafeInteger(fp.size) && fp.size >= 0 && fp.size <= MAX_BYTES && Number.isSafeInteger(fp.mode)
        && /^\d+$/.test(fp.device ?? '') && /^\d+$/.test(fp.inode ?? '') && /^-?\d+$/.test(fp.modified ?? ''));
}
export async function loadFileTransfer(repo, ref) {
    validRef(ref);
    repo = await realpath(repo);
    const root = path.join(repo, `.agent-compare-transfer-${ref.id}`);
    const placeholder = { root, journal: { schema: 'agent-compare.file-transfer/v1', repo, ref, state: 'prepared', entries: [] } };
    await assertOwner(placeholder);
    const journal = await boundedJson(path.join(root, 'journal.json'), JOURNAL_BYTES);
    if (journal.schema !== 'agent-compare.file-transfer/v1' || journal.repo !== repo || journal.ref?.id !== ref.id || journal.ref?.token !== ref.token
        || !['prepared', 'writing', 'applied', 'restoring', 'restored', 'recovery'].includes(journal.state)
        || !Array.isArray(journal.entries) || journal.entries.length > MAX_ENTRIES)
        throw new FileTransferError('文件交接日志格式不支持');
    const seen = new Set();
    for (const entry of journal.entries) {
        validPath(entry.path);
        if (seen.has(entry.path) || !validFingerprint(entry.before) || !validFingerprint(entry.after)
            || !['prepared', 'capturing', 'captured', 'publishing', 'published', 'undoing', 'restored'].includes(entry.phase))
            throw new FileTransferError('文件交接日志内容无效');
        seen.add(entry.path);
    }
    return { root, journal };
}
/** Prepare all replacement bytes and prove no-replace links work before moving any project file. */
export async function prepareFileTransfer(repo, tree, operations, ref, expected) {
    validRef(ref);
    repo = await realpath(repo);
    if (operations.length > MAX_ENTRIES)
        throw new FileTransferError('改动文件数量超过直接写回上限，请另存分支');
    const paths = operations.map(operation => operation.path);
    if (new Set(paths.map(file => process.platform === 'win32' ? file.toLowerCase() : file)).size !== paths.length)
        throw new FileTransferError('改动包含重复或大小写冲突的路径，请另存分支');
    const before = expected ?? await transferPreimages(repo, paths);
    for (const relative of paths) {
        await ordinaryParents(repo, relative, false);
        if (before[relative]?.kind === 'other')
            throw new FileTransferError('符号链接或特殊文件不能直接写回，请另存分支查看', [relative]);
    }
    const modes = await git(repo, ['ls-tree', '-r', '-z', '--full-tree', tree]);
    const files = new Map(modes.split('\0').filter(Boolean).map(line => [line.slice(line.indexOf('\t') + 1), line.slice(0, 6)]));
    for (const operation of operations)
        if (operation.status !== 'D' && !['100644', '100755'].includes(files.get(operation.path) ?? ''))
            throw new FileTransferError('这类文件变更需要另存分支查看', [operation.path]);
    const root = path.join(repo, `.agent-compare-transfer-${ref.id}`);
    await mkdir(root, { mode: 0o700 });
    await writeFile(path.join(root, '.gitignore'), '*\n', { flag: 'wx', mode: 0o600 });
    await writeFile(path.join(root, 'owner.json'), JSON.stringify({ schema: 'agent-compare.file-transfer/v1', repo, id: ref.id, token: ref.token }), { flag: 'wx', mode: 0o600 });
    for (const directory of ['next', 'before', 'undo', 'checkout', 'restore'])
        await mkdir(path.join(root, directory));
    const transfer = { root, journal: { schema: 'agent-compare.file-transfer/v1', repo, ref, state: 'prepared', entries: [] } };
    const probe = await open(path.join(root, 'link-probe'), 'wx', 0o600);
    await probe.close();
    try {
        await link(path.join(root, 'link-probe'), path.join(root, 'link-probe-copy'));
    }
    catch {
        throw new FileTransferError('当前文件系统不支持不覆盖已有路径的文件交接，请另存分支');
    }
    const checkout = path.join(root, 'checkout');
    const env = { GIT_INDEX_FILE: path.join(root, 'index'), GIT_WORK_TREE: checkout };
    const limits = { timeoutMs: 60_000 };
    await git(repo, ['read-tree', tree], env, undefined, limits);
    const writes = operations.filter(operation => operation.status !== 'D').map(operation => operation.path);
    const attributes = [...files.keys()].filter(file => path.posix.basename(file) === '.gitattributes');
    if (attributes.length)
        await git(repo, ['checkout-index', '--force', '--stdin', '-z', `--prefix=${checkout.replace(/\\/g, '/')}/`], env, attributes.join('\0') + '\0', limits);
    if (writes.length)
        await git(repo, ['checkout-index', '--force', '--stdin', '-z', `--prefix=${checkout.replace(/\\/g, '/')}/`], env, writes.join('\0') + '\0', limits);
    let retainedBytes = 0;
    for (const [index, operation] of operations.entries()) {
        const beforeFile = before[operation.path] ?? MISSING;
        let after = MISSING;
        if (operation.status !== 'D') {
            await rename(path.join(checkout, operation.path), slot(transfer, 'next', index));
            const handle = await open(slot(transfer, 'next', index), 'r+');
            try {
                await handle.sync();
            }
            finally {
                await handle.close();
            }
            after = await fileFingerprint(slot(transfer, 'next', index));
            if (after.kind !== 'file')
                throw new FileTransferError('候选不是普通文件，请另存分支', [operation.path]);
        }
        retainedBytes += (beforeFile.size ?? 0) + (after.size ?? 0);
        if (retainedBytes > MAX_BYTES)
            throw new FileTransferError('本次文件交接超过原始内容保留上限，请另存分支');
        transfer.journal.entries.push({ path: operation.path, before: beforeFile, after, phase: 'prepared' });
    }
    await save(transfer);
    return transfer;
}
export function affectedTransferPaths(transfer) {
    return transfer.journal.entries.filter(entry => entry.phase !== 'prepared').map(entry => entry.path);
}
/** Capture the actual old inode first; publish a hard link that can never replace an existing path. */
export async function publishTransferEntry(transfer, index) {
    await assertOwner(transfer);
    const entry = transfer.journal.entries[index];
    if (entry.phase !== 'prepared' || await statIfPresent(slot(transfer, 'before', index)))
        throw new FileTransferError('这个文件交接不能重复执行', [entry.path]);
    const target = path.join(transfer.journal.repo, entry.path);
    await ordinaryParents(transfer.journal.repo, entry.path, entry.after.kind !== 'missing');
    transfer.journal.state = 'writing';
    if (entry.before.kind !== 'missing') {
        entry.phase = 'capturing';
        await save(transfer);
        await rename(target, slot(transfer, 'before', index));
        await syncDirectory(path.dirname(target));
        await syncDirectory(path.join(transfer.root, 'before'));
        entry.phase = 'captured';
        await save(transfer);
        if (!sameFile(await fileFingerprint(slot(transfer, 'before', index)), entry.before))
            throw new FileTransferError('文件交接时检测到新编辑，已保留实际原始文件', [entry.path]);
    }
    entry.phase = 'publishing';
    await save(transfer);
    if (entry.after.kind !== 'missing') {
        if (!sameFile(await fileFingerprint(slot(transfer, 'next', index)), entry.after))
            throw new FileTransferError('准备好的候选文件发生变化', [entry.path]);
        await link(slot(transfer, 'next', index), target);
        await syncDirectory(path.dirname(target));
    }
    entry.phase = 'published';
    await save(transfer);
}
export async function finishFileTransfer(transfer) {
    for (const [index, entry] of transfer.journal.entries.entries()) {
        if (entry.before.kind !== 'missing' && !sameFile(await fileFingerprint(slot(transfer, 'before', index)), entry.before))
            throw new FileTransferError('交接期间保留的原始文件又发生了变化', [entry.path]);
    }
    transfer.journal.state = 'applied';
    await save(transfer);
}
/** Never delete or replace a path created or edited by another writer. All captured bytes remain retained. */
export async function restoreFileTransfer(repo, ref) {
    const transfer = await loadFileTransfer(repo, ref);
    transfer.journal.state = 'restoring';
    await save(transfer);
    const restored = [], conflicts = [];
    for (let index = transfer.journal.entries.length - 1; index >= 0; index--) {
        const entry = transfer.journal.entries[index], target = path.join(transfer.journal.repo, entry.path);
        try {
            await assertOwner(transfer);
            await ordinaryParents(transfer.journal.repo, entry.path, false);
            const backup = slot(transfer, 'before', index), removed = slot(transfer, 'undo', index);
            const backupStat = await statIfPresent(backup), removedStat = await statIfPresent(removed);
            let current = await fileFingerprint(target);
            if (removedStat && !sameFile(await fileFingerprint(removed), entry.after, false)) {
                if (current.kind === 'missing' && removedStat.isFile() && !removedStat.isSymbolicLink())
                    await restoreCopy(transfer, removed, target);
                throw new FileTransferError('撤销交接时出现了新编辑，已保留', [entry.path]);
            }
            if (backupStat && current.kind === 'missing') {
                if (!backupStat.isFile() || backupStat.isSymbolicLink())
                    throw new FileTransferError('保留内容需要手动恢复', [entry.path]);
                await restoreCopy(transfer, backup, target);
                entry.phase = 'restored';
                await save(transfer);
                restored.push(entry.path);
                continue;
            }
            const original = backupStat ? await fileFingerprint(backup) : entry.before;
            if (backupStat && sameFile(current, original, false)) {
                entry.phase = 'restored';
                await save(transfer);
                restored.push(entry.path);
                continue;
            }
            if (entry.phase === 'prepared' || (entry.phase === 'capturing' && !backupStat))
                continue;
            if (current.kind === 'missing') {
                if (entry.before.kind === 'missing') {
                    entry.phase = 'restored';
                    await save(transfer);
                    restored.push(entry.path);
                    continue;
                }
                throw new FileTransferError('找不到已保留的原始文件', [entry.path]);
            }
            if (!sameFile(current, entry.after, false) || removedStat)
                throw new FileTransferError('文件已被编辑，没有覆盖它', [entry.path]);
            entry.phase = 'undoing';
            await save(transfer);
            await rename(target, removed);
            await syncDirectory(path.dirname(target));
            await syncDirectory(path.join(transfer.root, 'undo'));
            const removedFile = await fileFingerprint(removed);
            if (!sameFile(removedFile, entry.after, false)) {
                await restoreCopy(transfer, removed, target).catch(error => { if (!errno(error, 'EEXIST'))
                    throw error; });
                throw new FileTransferError('撤销写入前检测到新编辑，已保留实际文件', [entry.path]);
            }
            if (entry.before.kind !== 'missing') {
                if (!backupStat?.isFile() || backupStat.isSymbolicLink())
                    throw new FileTransferError('找不到普通原始文件', [entry.path]);
                await restoreCopy(transfer, backup, target);
            }
            current = await fileFingerprint(target);
            if (entry.before.kind !== 'missing' && !sameFile(current, await fileFingerprint(backup), false))
                throw new FileTransferError('原始内容恢复尚未完成', [entry.path]);
            if (entry.before.kind === 'missing' && current.kind !== 'missing')
                throw new FileTransferError('原路径出现新文件，已保留', [entry.path]);
            entry.phase = 'restored';
            await save(transfer);
            restored.push(entry.path);
        }
        catch {
            conflicts.push(entry.path);
        }
    }
    transfer.journal.state = conflicts.length ? 'recovery' : 'restored';
    await save(transfer);
    return { restored, conflicts };
}
export function fileTransferDirectory(repo, ref) {
    validRef(ref);
    return path.join(repo, `.agent-compare-transfer-${ref.id}`);
}
