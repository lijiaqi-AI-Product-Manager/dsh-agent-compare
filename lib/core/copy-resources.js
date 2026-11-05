import { createHash } from 'node:crypto';
import { lstat, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { git, ownedCopyTree, ownedWorktreeAdmin } from './git.js';
import { RUN_COORDINATION } from './types.js';
/** Inspect only. Never follows dependency links or deletes user material. */
export async function planCopyCleanup(record, signal) {
    const reasons = [], resources = [], signatures = [];
    const active = new Set(['running', 'adopting', 'recovery']);
    if (record.coordination !== RUN_COORDINATION)
        reasons.push('旧记录没有当前版本的资源归属凭据，只能查看。');
    if (active.has(record.state) || record.candidates.some(candidate => !['ready', 'failed', 'cancelled', 'interrupted'].includes(candidate.stage)))
        reasons.push('比较、验收或恢复尚未结束，不能释放副本。');
    if (record.candidates.some(candidate => candidate.stopUnconfirmed) || record.adoption?.rehearsal?.stopUnconfirmed)
        reasons.push('有任务进程尚未确认退出，请先处理进程状态。');
    if (record.adoption && ['rehearsing', 'writing', 'reverting', 'needs-attention', 'needs-recovery'].includes(record.adoption.state))
        reasons.push('采用或恢复仍需要处理，不能释放副本。');
    if (record.revealedAt === undefined && record.state !== 'abandoned')
        reasons.push('请先完成选择或选择“都不满意”，再查看副本空间；盲选期间不展示两版的规模。');
    if (!reasons.length) {
        const targets = record.candidates.map(candidate => ({ label: candidate.label, dir: candidate.dir, token: candidate.ownerToken, tree: candidate.candidateTree, stopsPreview: !!candidate.preview, previewCwd: candidate.preview?.cwd }));
        const rehearsal = record.adoption?.rehearsal;
        if (rehearsal?.dir)
            targets.push({ label: 'R', dir: rehearsal.dir, token: rehearsal.ownerToken, tree: rehearsal.tree, stopsPreview: false, previewCwd: undefined });
        const deadline = Date.now() + 20_000;
        for (const target of targets) {
            signal?.throwIfAborted();
            if (!target.dir) {
                if (target.stopsPreview)
                    reasons.push(`副本 ${target.label}：预览缺少对应副本目录，不能确认本次释放范围。`);
                continue;
            }
            const resource = { label: target.label, path: target.dir, bytes: 0, files: 0, links: 0, stopsPreview: target.stopsPreview };
            try {
                const stat = await lstat(target.dir).catch(error => { if (error.code === 'ENOENT')
                    return undefined; throw error; });
                if (!stat) {
                    if (target.stopsPreview)
                        throw new Error('预览对应的副本目录不存在，请先处理预览状态。');
                    continue;
                }
                if (target.previewCwd && normalizedPath(target.previewCwd) !== normalizedPath(target.dir))
                    throw new Error('预览目录与副本不一致，不能确认本次释放范围。');
                if (!target.token || !target.tree)
                    throw new Error('没有完整的归属与封存依据，保留副本。');
                const copy = { repo: record.baseline.repoRoot, owner: { runId: record.runId, label: target.label, token: target.token }, yarnModern: record.acceptance.runtime.yarnModern };
                await ownedWorktreeAdmin(copy.repo, target.dir, copy.owner);
                if (await ownedCopyTree(target.dir, copy, target.tree) !== target.tree)
                    throw new Error('副本有未封存的后续修改，保留文件；请先导出或保存这些改动。');
                const usage = await measureDirectory(target.dir, deadline, signal);
                resources.push({ ...resource, ...usage.counts });
                signatures.push(usage.fingerprint);
            }
            catch (error) {
                signal?.throwIfAborted();
                const reason = error.message;
                resources.push({ ...resource, reason });
                reasons.push(`副本 ${target.label}：${reason}`);
            }
        }
        if (!resources.length)
            reasons.push('没有可释放的工作副本；运行记录与撤销原件继续保留。');
    }
    let retained;
    if (record.revealedAt !== undefined || record.state === 'abandoned') {
        const refs = await git(record.baseline.repoRoot, ['for-each-ref', '--format=%(refname)', `refs/agent-compare/${record.runId}/`]).then(text => text.trim() ? text.trim().split('\n').length : 0).catch(() => undefined);
        retained = { ...(refs === undefined ? {} : { gitRefs: refs }), childSessions: record.candidates.filter(candidate => !!candidate.childId).length, sealedPatches: record.candidates.filter(candidate => !!candidate.patchFile).length, sourceRepository: record.baseline.repoRoot };
    }
    const base = { version: 1, runId: record.runId, rev: record.rev, state: record.state, allowed: reasons.length === 0, reasons, resources, bytes: resources.reduce((sum, resource) => sum + resource.bytes, 0), ...(retained ? { retained } : {}) };
    return { ...base, token: createHash('sha256').update(JSON.stringify({ ...base, signatures })).digest('hex') };
}
function normalizedPath(value) {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
async function measureDirectory(root, deadline, signal) {
    const canonical = await realpath(root), counts = { bytes: 0, files: 0, links: 0 }, hash = createHash('sha256');
    let entries = 0;
    const pending = [root];
    while (pending.length) {
        signal?.throwIfAborted();
        if (Date.now() > deadline || entries > 100_000)
            throw new Error('空间扫描超过本次上限，尚未确认完整清单；未删除任何副本。');
        const directory = pending.pop(), before = await lstat(directory);
        if (!before.isDirectory() || before.isSymbolicLink())
            throw new Error('扫描期间目录被替换，保留副本。');
        const actual = await realpath(directory), relative = path.relative(canonical, actual);
        if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative))
            throw new Error('资源路径离开了副本，保留目录。');
        // Sort each directory so a repeated inspection produces the same token.
        const names = [];
        const opened = await opendir(directory);
        for await (const entry of opened) {
            signal?.throwIfAborted();
            if (entries + names.length >= 100_000 || Date.now() > deadline)
                throw new Error('空间扫描超过本次上限，尚未确认完整清单；未删除任何副本。');
            names.push(entry.name);
        }
        names.sort();
        for (const name of names) {
            if (++entries > 100_000 || Date.now() > deadline)
                throw new Error('空间扫描超过本次上限，尚未确认完整清单；未删除任何副本。');
            const file = path.join(directory, name), stat = await lstat(file);
            hash.update(JSON.stringify([path.relative(root, file), stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.isSymbolicLink()]));
            if (stat.isSymbolicLink())
                counts.links++;
            else if (stat.isDirectory())
                pending.push(file);
            else if (stat.isFile()) {
                counts.files++;
                counts.bytes += stat.size;
            }
            else
                throw new Error('副本中有不支持的特殊文件，保留目录。');
        }
        const after = await lstat(directory);
        if (after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs || after.isSymbolicLink())
            throw new Error('扫描期间副本发生变化，请刷新清单。');
    }
    return { counts, fingerprint: hash.digest('hex') };
}
