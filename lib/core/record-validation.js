import path from 'node:path';
import { parseBrowserCheck } from './acceptance-config.js';
import { RUN_COORDINATION, RUN_SCHEMA } from './types.js';
import { parsePreviewUrl } from './preview-url.js';
export const MAX_RECORD_BYTES = 16 * 1024 * 1024;
export const isRunId = (value) => typeof value === 'string' && /^[0-9a-f]{8}$/.test(value);
export class RecordValidationError extends Error {
    field;
    constructor(field) {
        super(`记录字段无效：${field}`);
        this.field = field;
        this.name = 'RecordValidationError';
    }
}
const invalid = (field) => { throw new RecordValidationError(field); };
const text = (max = 65536, empty = true) => (value, field) => {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
        invalid(field);
};
const count = (min = 0, max = Number.MAX_SAFE_INTEGER) => (value, field) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
        invalid(field);
};
const boolean = (value, field) => { if (typeof value !== 'boolean')
    invalid(field); };
const optional = (rule) => (value, field) => { if (value !== undefined)
    rule(value, field); };
const oneOf = (...choices) => (value, field) => { if (typeof value !== 'string' || !choices.includes(value))
    invalid(field); };
const pattern = (expression) => (value, field) => { if (typeof value !== 'string' || !expression.test(value))
    invalid(field); };
const object = (value, field) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        invalid(field);
    return value;
};
const shape = (fields) => (value, field) => {
    const raw = object(value, field);
    if (Object.keys(raw).some(key => !Object.hasOwn(fields, key)))
        invalid(`${field}（未知字段）`);
    for (const [key, rule] of Object.entries(fields))
        rule(Object.hasOwn(raw, key) ? raw[key] : undefined, `${field}.${key}`);
};
const array = (rule, max = 100000) => (value, field) => {
    if (!Array.isArray(value) || value.length > max)
        invalid(field);
    for (const [index, item] of value.entries())
        rule(item, `${field}[${index}]`);
};
const dictionary = (rule, keys) => (value, field) => {
    const entries = Object.entries(object(value, field));
    if (entries.length > 100000)
        invalid(field);
    for (const [key, item] of entries) {
        keys?.(key, `${field}（键）`);
        rule(item, `${field}（值）`);
    }
};
const pathText = (value, field) => {
    text(32768, false)(value, field);
    if (value.includes('\0'))
        invalid(field);
};
const absolutePath = (value, field) => {
    pathText(value, field);
    // A stored path's shape is not proof of filesystem ownership. Operations
    // still verify their repository, worktree mark, content and process owner.
    if (!path.posix.isAbsolute(value) && !path.win32.isAbsolute(value))
        invalid(field);
};
const repositoryPath = (value, field) => {
    pathText(value, field);
    const file = value;
    if (file.includes('\\') || file.includes(':') || path.posix.isAbsolute(file)
        || file.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git'))
        invalid(field);
};
const paths = (value, field) => {
    array(repositoryPath)(value, field);
    if (new Set(value).size !== value.length)
        invalid(field);
};
const identifier = pattern(/^[0-9a-f]{8}$/);
const gitObject = pattern(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const sha256 = pattern(/^[0-9a-f]{64}$/);
const label = oneOf('A', 'B');
const stages = ['queued', 'preparing', 'generating', 'sealing', 'installing', 'verifying', 'previewing', 'ready', 'failed', 'stopping', 'cancelled', 'interrupted'];
const stage = oneOf(...stages);
const route = shape({ provider: optional(text(500, false)), model: optional(text(1000, false)), reasoningEffort: optional(text(100, false)) });
const strategy = shape({ id: text(200, false), title: text(1000, false), instruction: text(1048576) });
const command = shape({ name: text(200, false), argv: array(pathText, 256), timeoutMs: optional(count(1)) });
const browser = (value, field) => { try {
    parseBrowserCheck(value);
}
catch {
    invalid(field);
} };
const check = shape({
    name: text(200, false), outcome: oneOf('passed', 'failed', 'skipped', 'timeout'), durationMs: count(), tail: text(), reason: optional(text()),
    steps: optional(array(shape({ label: text(), ok: boolean, detail: optional(text()) }), 100)),
    screenshot: optional(absolutePath), mobileScreenshot: optional(absolutePath),
});
const preview = (value, field) => {
    shape({ url: text(32768, false), port: count(1, 65535), pid: count(1), kind: oneOf('build', 'dev'), cwd: absolutePath })(value, field);
    const raw = value;
    try {
        parsePreviewUrl(raw.url, raw.port);
    }
    catch {
        invalid(`${field}.url`);
    }
};
const usage = (value, field) => {
    const raw = object(value, field);
    if (raw.kind === 'unknown')
        shape({ kind: oneOf('unknown'), reason: text() })(raw, field);
    else
        shape({ kind: oneOf('reported'), inputTokens: optional(count()), outputTokens: optional(count()), cacheReadTokens: optional(count()), cacheWriteTokens: optional(count()), totalTokens: optional(count()) })(raw, field);
};
const timing = shape({ startedAt: count(), endedAt: optional(count()) });
const install = shape({ argv: array(pathText, 256), frozen: boolean, durationMs: count(), outcome: optional(oneOf('passed', 'failed', 'timeout', 'cancelled')),
    runtime: optional(shape({ hostNode: text(200, false), platform: text(200, false), packageManager: pathText, packageManagerVersion: optional(text(200, false)) })),
    failure: optional(shape({ kind: oneOf('network', 'authentication', 'filesystem', 'runtime', 'lockfile', 'timeout', 'cancelled', 'unknown'), summary: text(2000), hint: text(4000), code: optional(text(200)), diagnostic: optional(text(4000)) })),
});
const candidate = shape({
    label, strategy, route, stage, actualRoute: optional(route),
    generation: optional(shape({ ended: oneOf('completed', 'budget', 'agent-stopped'), stopReason: optional(text()) })),
    progress: optional(shape({ steps: count(), lastAction: optional(text()), lastActivityAt: count(), tokens: optional(count()) })),
    dir: optional(absolutePath), ownerToken: optional(pattern(/^[0-9a-f]{24}$/)), childId: optional(text(500, false)), stopReason: optional(text()), summary: optional(text()), usage: optional(usage),
    patchFile: optional(absolutePath), patchSha256: optional(sha256), patchStats: optional(shape({ files: count(), insertions: count(), deletions: count(), binary: count() })),
    touchedFiles: optional(paths), candidateCommit: optional(gitObject), candidateTree: optional(gitObject), acceptanceTouched: optional(array(text())), dependencyChange: optional(boolean),
    install: optional(install),
    verificationHistory: optional(array(shape({ recordedAt: count(), durationMs: optional(count()), install: optional(install), checks: optional(array(check, 256)), error: optional(shape({ stage, message: text() })) }), 100)),
    execution: optional(shape({ enforcement: oneOf('full', 'partial', 'unknown') })), checks: optional(array(check, 256)), checkedTree: optional(gitObject), drift: optional(paths),
    preview: optional(preview), screenshot: optional(absolutePath), mobileScreenshot: optional(absolutePath),
    verdict: optional(shape({ eligible: boolean, reasons: array(text(), 10000), warnings: array(text(), 10000) })),
    timings: dictionary(timing, stage), error: optional(shape({ stage, message: text() })), stopUnconfirmed: optional(boolean),
});
const adoption = shape({
    label, mode: oneOf('worktree', 'branch'), state: oneOf('rehearsing', 'blocked', 'writing', 'reverting', 'adopted', 'needs-attention', 'rolled-back', 'needs-recovery', 'reverted'),
    startedAt: count(), endedAt: optional(count()), preAdoptCommit: optional(gitObject), expectedTree: optional(gitObject), headBefore: optional(gitObject), stagedBefore: optional(sha256),
    rehearsal: optional(shape({ reused: boolean, tree: gitObject, checks: optional(array(check, 256)), dir: optional(absolutePath), ownerToken: optional(pattern(/^[0-9a-f]{24}$/)), stopUnconfirmed: optional(boolean) })),
    writtenPaths: optional(paths), branch: optional(pathText), message: optional(text()), attention: optional(array(text())),
    fileTransfer: optional(shape({ id: pattern(/^[0-9a-f]{32}$/), token: pattern(/^[0-9a-f]{32}$/) })), transferDirection: optional(oneOf('apply', 'undo')),
    transferReturn: optional(oneOf('adopted', 'recovery')),
    retainedTransfers: optional(array(shape({ id: pattern(/^[0-9a-f]{32}$/), token: pattern(/^[0-9a-f]{32}$/) }))),
});
const record = shape({
    coordination: optional(oneOf(RUN_COORDINATION)),
    schema: oneOf(RUN_SCHEMA), producer: shape({ name: oneOf('dsh-agent-compare'), version: text(200, false) }), runId: identifier, createdAt: count(), updatedAt: count(), rev: count(), task: text(1048576, false),
    sessionId: optional(text(500, false)), follows: optional(identifier), origin: optional(shape({ kind: oneOf('command', 'tool', 'panel'), id: optional(text(1000, false)) })),
    baseline: shape({ repoRoot: absolutePath, headCommit: optional(gitObject), snapshotCommit: gitObject, snapshotTree: gitObject, dirty: boolean }),
    acceptance: shape({
        checks: shape({ commands: array(command, 256), browser: optional(browser) }), scripts: dictionary(text()), bound: dictionary(gitObject, repositoryPath), lockfile: optional(repositoryPath),
        runtime: shape({ node: text(200, false), packageManager: text(200, false), platform: text(200, false) }), source: oneOf('defaults', 'repository'), sha256,
    }),
    mode: oneOf('same-model', 'cross-model'), isolation: oneOf('own-root', 'shared-root'), budget: shape({ generationMs: count(1) }),
    state: oneOf('running', 'judging', 'revealed', 'adopting', 'adopted', 'recovery', 'abandoned', 'interrupted'), candidates: array(candidate, 2),
    choice: optional(shape({ pick: oneOf('A', 'B', 'none'), at: count(), note: optional(text()) })), revealedAt: optional(count()), checksFavoured: optional(oneOf('A', 'B', 'tie', 'none')),
    adoption: optional(adoption), outsideChanges: optional(paths), leftovers: optional(array(text())),
});
/** Validate data, not authority: no record is allowed to select its own filename. */
export function assertRunRecord(value, expectedId, allowInitial = false) {
    if (!isRunId(expectedId))
        invalid('runId');
    record(value, 'record');
    const raw = value;
    if (raw.runId !== expectedId)
        invalid('runId（与文件名不一致）');
    if (raw.rev < (allowInitial ? 0 : 1))
        invalid('rev');
    if (raw.candidates.length !== 2 || raw.candidates[0]?.label !== 'A' || raw.candidates[1]?.label !== 'B')
        invalid('candidates（必须各有一份 A 和 B）');
    for (const command of raw.acceptance.checks.commands)
        if (!command.argv.length)
            invalid('acceptance.checks.commands.argv');
    for (const item of raw.candidates)
        if (item.install && !item.install.argv.length)
            invalid('candidates.install.argv');
}
