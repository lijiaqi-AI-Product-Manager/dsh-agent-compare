/**
 * Where a comparison works.
 *
 * - `repository`: the conversation's directory is inside a Git repository.
 *   Copies come from that repository; `projectPath` is the directory the
 *   project lives in (empty for the repository root, or a monorepo package).
 * - `folder`: anything else, including no directory at all. Both versions
 *   start in a private, empty repository owned by the plugin, so nothing in
 *   the user's folder changes until the user saves the picked version.
 */
import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ALWAYS_EXCLUDED, git, repoRoot } from './git.js';
/** Git's own answer for a directory outside any repository (messages are in the C locale). */
const NOT_A_REPOSITORY = /not a git repository/i;
export async function resolveWorkspace(cwd) {
    if (!cwd?.trim())
        return { kind: 'folder' };
    const dir = path.resolve(cwd);
    if (!existsSync(dir))
        throw new Error(`找不到当前对话的目录：${dir}`);
    let root;
    try {
        root = await repoRoot(dir);
    }
    catch (error) {
        // Only "outside any repository" means a folder. Any other Git failure
        // (Git missing, an untrusted owner) is reported instead of silently
        // starting from an empty workspace in place of the user's project.
        if (NOT_A_REPOSITORY.test(error.message))
            return { kind: 'folder', folder: dir };
        throw error;
    }
    const real = await realpath(dir).catch(() => dir);
    const inside = path.relative(root, real);
    // A directory reached through a differently spelled path (substituted drive,
    // short name) still belongs to the repository; treat it as its root.
    const projectPath = inside.startsWith('..') || path.isAbsolute(inside) ? '' : inside.split(path.sep).filter(Boolean).join('/');
    return { kind: 'repository', root, projectPath };
}
/** A new, empty repository for one comparison. No user templates or hooks are copied into it. */
export async function createPrivateWorkspace(dir) {
    await mkdir(dir, { recursive: true });
    await git(dir, ['init', '--quiet', '--template=']);
    return path.resolve((await git(dir, ['rev-parse', '--show-toplevel'])).trim());
}
/** Limits for turning a folder into a repository: its files are copied into both versions. */
export const ENABLE_GIT_LIMITS = { files: 5_000, bytes: 300 * 1024 * 1024 };
const sameDir = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const within = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
/**
 * Whether `folder` may become a Git repository so both versions can start
 * from its files. Counts exactly what a comparison would copy: Git's own
 * ignore rules apply, and dependency folders are left out as in every run.
 */
export async function checkEnableGit(folder, opts = {}) {
    const limits = opts.limits ?? ENABLE_GIT_LIMITS;
    let dir;
    try {
        dir = await realpath(path.resolve(folder));
        if (!(await lstat(dir)).isDirectory())
            return { ok: false, reason: '这个路径不是文件夹。' };
    }
    catch {
        return { ok: false, reason: '找不到这个文件夹。' };
    }
    if (sameDir(dir, path.parse(dir).root))
        return { ok: false, reason: '不能在磁盘根目录启用 Git，请打开具体的项目文件夹。' };
    const home = await realpath(os.homedir()).catch(() => os.homedir());
    if (sameDir(dir, home))
        return { ok: false, reason: '不能在用户主目录启用 Git，请打开具体的项目文件夹。' };
    const system = process.platform === 'win32'
        ? [process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter((v) => !!v)
        : ['/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/sbin', '/sys', '/usr', '/var', '/System', '/Library', '/Applications'];
    if (system.some(entry => within(path.resolve(entry), dir)))
        return { ok: false, reason: '不能在系统目录中启用 Git。' };
    if ((await resolveWorkspace(dir)).kind === 'repository')
        return { ok: false, reason: '这个文件夹已经在 Git 仓库中。' };
    // Git lists nothing until it has walked the whole tree. Count first and stop
    // at the limit: without root ignore rules, more entries means too many files.
    if (!existsSync(path.join(dir, '.gitignore')) && await exceedsQuickly(dir, limits.files)) {
        return { ok: false, reason: `文件夹里的文件超过 ${limits.files.toLocaleString()} 个的上限。请打开具体的项目文件夹，或先用 .gitignore 排除缓存与依赖目录。` };
    }
    // List what `git add -A` would take, through a throwaway repository, so the
    // folder itself gains nothing unless the user goes ahead.
    const probe = await mkdtemp(path.join(os.tmpdir(), 'agent-compare-probe-'));
    try {
        await git(probe, ['init', '--quiet', '--template=']);
        const listed = await listUntracked(dir, path.join(probe, '.git'), limits.files, opts.timeoutMs ?? 15_000);
        if (listed.kind === 'too-many')
            return { ok: false, reason: `文件夹里的文件超过 ${limits.files.toLocaleString()} 个的上限。请打开具体的项目文件夹，或先用 .gitignore 排除缓存与依赖目录。` };
        if (listed.kind === 'timeout')
            return { ok: false, reason: '文件夹太大，没能在时限内数完文件。请打开具体的项目文件夹，或先用 .gitignore 排除缓存与依赖目录。' };
        if (listed.kind === 'failed')
            return { ok: false, reason: `无法读取文件夹内容：${listed.message}` };
        const files = listed.files;
        let bytes = 0;
        for (const file of files) {
            try {
                bytes += (await lstat(path.join(dir, file))).size;
            }
            catch { /* removed meanwhile */ }
            if (bytes > limits.bytes)
                return { ok: false, reason: `文件夹内容超过 ${Math.round(limits.bytes / 1024 / 1024)} MB。请打开具体的项目文件夹，或先用 .gitignore 排除大文件。` };
        }
        return { ok: true, folder: dir, files: files.length, bytes };
    }
    finally {
        await rm(probe, { recursive: true, force: true }).catch(() => { });
    }
}
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.vite', '.git']);
/**
 * Whether `dir` has more than `limit` files Git would count, decided within a
 * short budget. Dependency folders, nested repositories (one entry for Git)
 * and folders that ignore everything inside them (`.gitignore` of `*`, as in
 * virtual environments and tool caches) are left out. Undecided is `false`:
 * the precise Git listing then decides.
 */
async function exceedsQuickly(dir, limit, budgetMs = 3_000) {
    const deadline = Date.now() + budgetMs;
    const pending = [dir];
    let files = 0;
    while (pending.length) {
        if (Date.now() > deadline)
            return false;
        const directory = pending.pop();
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        }
        catch {
            continue;
        }
        if (directory !== dir) {
            if (entries.some(entry => entry.name === '.git')) {
                files++;
                continue;
            }
            if (entries.some(entry => entry.name === '.gitignore' && entry.isFile())) {
                const rules = await readFile(path.join(directory, '.gitignore'), 'utf8').catch(() => '');
                if (rules.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).join('\n') === '*')
                    continue;
            }
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name))
                    pending.push(path.join(directory, entry.name));
            }
            else if (++files > limit)
                return true;
        }
    }
    return false;
}
/**
 * The files Git would add in `dir`, read as they stream. Git is stopped as
 * soon as there are more than `limit`, so a huge folder answers quickly.
 */
function listUntracked(dir, gitDir, limit, timeoutMs) {
    return new Promise(resolve => {
        const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))), GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
        const child = spawn('git', [`--git-dir=${gitDir}`, `--work-tree=${dir}`, 'ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...ALWAYS_EXCLUDED], { cwd: dir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const files = [];
        let pending = '', stderr = '', settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (child.exitCode === null && child.signalCode === null)
                child.kill();
            resolve(value);
        };
        const timer = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);
        child.stdout.setEncoding('utf8').on('data', (chunk) => {
            const parts = (pending + chunk).split('\0');
            pending = parts.pop() ?? '';
            for (const part of parts)
                if (part)
                    files.push(part);
            if (files.length > limit)
                finish({ kind: 'too-many' });
        });
        child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000); });
        child.on('error', error => finish({ kind: 'failed', message: error.message }));
        child.on('close', code => {
            if (pending)
                files.push(pending);
            finish(code === 0 ? (files.length > limit ? { kind: 'too-many' } : { kind: 'files', files }) : { kind: 'failed', message: stderr.trim().split('\n')[0] || `git ls-files 退出码 ${code}` });
        });
    });
}
/** Create a repository in `folder` after `checkEnableGit` allowed it. Nothing is committed; no file changes. */
export async function enableGit(folder) {
    const check = await checkEnableGit(folder);
    if (!check.ok)
        throw new Error(check.reason);
    await git(check.folder, ['init', '--quiet']);
    return { root: await repoRoot(check.folder) };
}
