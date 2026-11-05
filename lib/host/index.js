var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Comparer, publicView, RunStore, RecordUnavailableError, defaultHome, createExampleRepo, exampleTask, DEFAULT_GENERATION_MS, } from '../core/index.js';
import { commandResultText, parseAbInput } from './conversation.js';
import { inspectProject } from '../core/project.js';
import { repoRoot } from '../core/git.js';
import { defaultPreferences, parseUiSubmission, PreferencesStore } from './preferences.js';
import { ConversationMemory } from './memory.js';
import { historyPage, HistoryQueryError } from './history.js';
import { observedRoute, selectedRoute } from './routes.js';
import { createProjectProcess, projectCommandArgv } from './project-process.js';
import { conversationResolver, SessionAccessError } from './session.js';
import { readComparisonStatus } from './status.js';
import { startToolComparison } from './start-tool.js';
import { hostCapabilities } from './capabilities.js';
import { HttpError, readBody } from './request.js';
export const name = 'agent-compare';
// webServer/connection are optional: headless and SDK profiles have no Web UI,
// and the tools must still work there.
export const inject = ['tools', 'agents'];
const VERSION = '1.0.1';
const ROUTE = '/agent-compare/api';
const DELEGATION_TEXT = 'You are a delegated candidate agent for AgentCompare: your permission scope was fixed when you were started and cannot be widened from inside this session — operations that require approval are rejected automatically. Work only in your working directory under the host write policy. When the task needs access beyond that scope, do not retry the denied operation; state the limitation in your reply.';
/** A session started by AgentCompare (or any delegated child) must not start another comparison. */
function isDelegated(agent) {
    return agent.session.header.origin === 'subagent';
}
/** Aggregate only complete provider-reported counters. Cache counters are disjoint input. */
export function usageFromEvents(events) {
    const messages = events.filter(e => e.type === 'assistant/message');
    const valid = (n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
    const components = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
    const usages = messages.map(e => {
        const raw = e.data?.usage;
        const u = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const known = components.reduce((n, key) => n + (valid(u[key]) ? u[key] : 0), 0);
        // A provider may omit cache counters. Input + output cannot reconstruct its total.
        const totalTokens = valid(u.totalTokens) && Number.isSafeInteger(known) && u.totalTokens >= known ? u.totalTokens : undefined;
        return { ...u, totalTokens };
    });
    const sum = {};
    for (const key of [...components, 'totalTokens']) {
        if (!usages.length || !usages.every(u => valid(u[key])))
            continue;
        const value = usages.reduce((total, u) => total + u[key], 0);
        if (valid(value))
            sum[key] = value;
    }
    return Object.keys(sum).length ? { kind: 'reported', ...sum } : { kind: 'unknown', reason: 'the session reported no complete valid token counters' };
}
/** Last non-empty assistant message text, as DSH's own subagent result selects it. */
export function finalText(events) {
    let last;
    for (const e of events) {
        const content = e.type === 'assistant/message' ? e.data?.message?.content : undefined;
        if (content !== undefined && content.length > 0)
            last = content;
    }
    return (last ?? []).filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim();
}
/** Observed activity so far: model steps taken, the latest tool call, tokens reported. */
export function progressOf(events) {
    let steps = 0;
    let lastAction;
    for (const e of events) {
        if (e.type === 'step/start')
            steps++;
        if (e.type === 'tool/call' && typeof e.data?.name === 'string') {
            let target = '';
            try {
                const args = typeof e.data.arguments === 'string' ? JSON.parse(e.data.arguments) : (e.data.arguments ?? {});
                const raw = args.file_path ?? args.path ?? args.pattern ?? args.command ?? '';
                target = String(raw).replace(/^.*[\\/](src[\\/])/, '$1').replace(/\s+/g, ' ').slice(0, 100);
            }
            catch { /* arguments still streaming or not JSON */ }
            lastAction = target ? `${e.data.name} ${target}` : e.data.name;
        }
    }
    const usage = usageFromEvents(events);
    return { steps, ...(lastAction === undefined ? {} : { lastAction }), ...(usage.kind === 'reported' && usage.totalTokens !== undefined ? { tokens: usage.totalTokens } : {}) };
}
/** Map the epoch's last turn ending onto the subagent stop-reason vocabulary. */
export function stopReasonOf(events) {
    const ends = events.filter((e) => e.type === 'turn/end');
    const kind = ends.at(-1)?.data?.reason?.kind;
    if (ends.length === 0)
        return 'error';
    switch (kind) {
        case 'max-tokens': return 'max-tokens';
        case 'aborted':
        case 'interrupted': return 'aborted';
        case 'error': return 'error';
        case 'blocked': return 'refusal';
        case undefined:
        case 'completed': return 'completed';
        default: return 'error';
    }
}
/**
 * Runs one candidate in a fresh DSH session whose `cwd` is the candidate copy.
 * The session's sandbox mode is pinned to workspace-write and approvals to
 * `never`, the same policy DSH gives its own delegated children, but the write
 * root is the copy instead of the parent's project.
 */
export class IsolatedSessionRunner {
    agents;
    userMessage;
    isolation = 'own-root';
    constructor(agents, userMessage = async () => (await import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-llm'))).createUserMessage) {
        this.agents = agents;
        this.userMessage = userMessage;
    }
    async run(req) {
        const parent = req.hostContext;
        if (parent === undefined)
            throw new Error('没有父会话：请在对话中发起比较');
        const createUserMessage = await this.userMessage();
        const route = req.route.model !== undefined ? req.route : selectedRoute(parent);
        const agentOptions = route.provider !== undefined && route.model !== undefined
            ? { provider: route.provider, model: route.model, ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }) }
            : undefined;
        const presets = parent.ctx.get('agentPresets');
        const agentPreset = presets?.composedPreset?.(parent.ctx);
        const handle = await this.agents.create({
            sessionId: randomUUID(),
            parentAgent: parent,
            meta: {
                cwd: req.cwd,
                parentSession: parent.session.id,
                isSeeded: false,
                origin: 'subagent',
                delegationDepth: (parent.session.header.delegationDepth ?? 0) + 1,
                ...(agentPreset === undefined ? {} : { agentPreset }),
            },
            ...(agentOptions === undefined ? {} : { agentOptions }),
            signal: req.signal,
            setup: (childCtx, child) => {
                child.session.append('sandbox/mode', { mode: 'workspace-write', source: 'delegation' });
                if (childCtx.get('approval') !== undefined)
                    child.session.append('approval/policy', { policy: 'never', source: 'delegation' });
                presets?.composeFrom?.(childCtx, parent.ctx);
                let order;
                try {
                    order = childCtx.systemPrompt?.getContextOrder?.('SUBAGENT_DELEGATION');
                }
                catch {
                    order = undefined;
                }
                childCtx.systemPrompt?.context({ name: 'agent-compare:candidate', ...(order === undefined ? {} : { order }), text: DELEGATION_TEXT });
            },
        });
        const child = handle.agent;
        const start = child.session.seq;
        const onAbort = () => { try {
            child.cancel({ kind: 'parent' });
        }
        catch { /* already stopped */ } };
        req.signal.addEventListener('abort', onAbort, { once: true });
        try {
            // A stop that landed while the session was being created would otherwise never reach it.
            if (req.signal.aborted)
                throw new Error('cancelled before the candidate started');
            child.followup(createUserMessage({ content: [{ type: 'text', text: req.prompt }], source: { kind: 'user' } }));
            // Report what the session is doing while it works; the agent itself says nothing until the end.
            let seen = -1;
            const watch = req.onProgress === undefined ? undefined : setInterval(() => {
                const events = child.session.snapshotEvents(start);
                if (events.length === seen)
                    return;
                seen = events.length;
                try {
                    req.onProgress(progressOf(events));
                }
                catch { /* progress is best effort */ }
            }, 2000);
            try {
                // Quiescent = idle with nothing queued and at least one turn ended (or cancelled).
                for (;;) {
                    await child.whenIdle();
                    const pending = (child.inbox?.nextTurn.length ?? 0) + (child.inbox?.nextStep.length ?? 0);
                    const ended = child.session.snapshotEvents(start).some((e) => e.type === 'turn/end');
                    if (pending === 0 && (ended || req.signal.aborted))
                        break;
                    await new Promise((r) => setTimeout(r, 250));
                }
            }
            finally {
                if (watch !== undefined)
                    clearInterval(watch);
            }
            const events = child.session.snapshotEvents(start);
            const summary = finalText(events);
            const actual = observedRoute(child);
            return {
                stopReason: req.signal.aborted ? 'aborted' : stopReasonOf(events),
                childId: child.session.id,
                ...(summary === '' ? {} : { summary }),
                usage: usageFromEvents(events),
                ...(actual?.model === undefined ? {} : { actualRoute: { ...(actual.provider === undefined ? {} : { provider: actual.provider }), model: actual.model, ...(actual.reasoningEffort === undefined ? {} : { reasoningEffort: actual.reasoningEffort }) } }),
            };
        }
        finally {
            req.signal.removeEventListener('abort', onAbort);
            await handle.dispose().catch(() => { });
        }
    }
}
/** Experimental fallback: a `ctx.subagents` child, whose write root is the parent's project. */
class SubagentRunner {
    subagents;
    provider;
    isolation = 'shared-root';
    constructor(subagents, provider) {
        this.subagents = subagents;
        this.provider = provider;
    }
    async run(req) {
        const parent = req.hostContext;
        if (parent === undefined)
            throw new Error('没有父会话：请在对话中发起比较');
        const agentOptions = req.route.provider !== undefined && req.route.model !== undefined
            ? { provider: req.route.provider, model: req.route.model, ...(req.route.reasoningEffort === undefined ? {} : { reasoningEffort: req.route.reasoningEffort }) }
            : undefined;
        const activation = await this.subagents.startActivation({
            provider: this.provider,
            label: `AgentCompare ${req.label}`,
            request: { prompt: [{ type: 'text', text: req.prompt }], parent, cwd: req.cwd, signal: req.signal, ...(agentOptions === undefined ? {} : { agentOptions }) },
            signal: req.signal,
            // We present the result ourselves; no completion notice is injected into the parent conversation.
            delivery: 'caller',
        });
        const onAbort = () => { void activation.dispose(); };
        req.signal.addEventListener('abort', onAbort, { once: true });
        if (req.signal.aborted)
            onAbort();
        try {
            const result = await activation.result;
            const summary = result.output.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim();
            return {
                stopReason: result.stopReason,
                childId: activation.childId,
                ...(summary === '' ? (result.diagnostic === undefined ? {} : { summary: result.diagnostic }) : { summary }),
                usage: { kind: 'unknown', reason: 'the DSH subagent result does not report token usage' },
            };
        }
        finally {
            req.signal.removeEventListener('abort', onAbort);
        }
    }
}
function brief(r) {
    const v = publicView(r);
    return {
        runId: v.runId,
        state: v.state,
        mode: v.mode,
        isolation: v.isolation,
        baselineDirty: v.baseline.dirty,
        acceptance: v.acceptance.checks,
        checksFavoured: v.checksFavoured,
        choice: v.choice?.pick,
        adoption: v.adoption === undefined ? undefined : { state: v.adoption.state, mode: v.adoption.mode, message: v.adoption.message },
        candidates: v.candidates.map((c) => ({
            label: c.label,
            stage: c.stage,
            previewUrl: c.previewUrl,
            checks: c.checks?.map((k) => `${k.name}:${k.outcome}`),
            eligible: c.verdict?.eligible,
            blockers: c.verdict?.reasons,
            ...(c.patchStats ? { files: c.patchStats.files } : {}),
            error: c.error?.message.split('\n')[0],
            ...(c.strategy === undefined ? {} : { strategy: c.strategy.title }),
        })),
    };
}
export async function apply(ctx, config = {}) {
    const { defineTool } = (await import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-tools')));
    const agents = ctx.get('agents');
    const subagents = ctx.get('subagents');
    let runner;
    if (config.isolation !== 'shared-root' && typeof agents?.create === 'function')
        runner = new IsolatedSessionRunner(agents);
    else if (subagents !== undefined) {
        runner = new SubagentRunner(subagents, config.provider ?? 'spawn');
        if (config.isolation !== 'shared-root')
            ctx.logger.warn('agent-compare: no agent factory on this host; falling back to shared-root subagents (escapes are detected, not prevented)');
    }
    else
        throw new Error('agent-compare needs ctx.agents (or ctx.subagents) to run candidates');
    const environmentContract = import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-subprocess')).then(service => typeof service.scrubbedParentEnv === 'function', () => false);
    const runtimeVersion = import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-app-boot')).then(service => typeof service.getDshRuntimeVersion === 'function' ? service.getDshRuntimeVersion() : undefined).catch(() => undefined);
    const capabilities = async () => hostCapabilities({
        isolation: runner.isolation,
        agents,
        subagents,
        sandbox: ctx.get('sandbox'),
        commands: ctx.get('commands'),
        sessionController: ctx.get('sessionController'),
        scrubbedParentEnv: await environmentContract,
    });
    const store = new RunStore(config.home ?? defaultHome());
    const preferences = new PreferencesStore(store, defaultPreferences(config.generationMinutes ?? 30));
    // Each milestone of a run becomes one model-facing note in its conversation,
    // so the conversation remembers what was compared, chosen and adopted.
    const memory = new ConversationMemory({
        findAgent: (sessionId) => agents?.list().find(a => a.session.id === sessionId),
        createMessage: async () => {
            try {
                return (await import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-llm'))).createUserMessage;
            }
            catch {
                return undefined;
            }
        },
        warn: message => ctx.logger.warn(message),
    });
    const remember = (record) => { void memory.remember(record); };
    const bundledPnpm = () => ctx.get('profileContext')?.packageManager;
    const comparer = new Comparer({
        store,
        runner,
        version: VERSION,
        prepareProjectProcess: createProjectProcess(() => ctx.get('sandbox'), undefined, undefined, bundledPnpm),
        generationMs: (config.generationMinutes ?? DEFAULT_GENERATION_MS / 60_000) * 60_000,
        maxActiveRuns: config.maxActiveRuns ?? 1,
        onUpdate: remember,
        onRecoveryIssue: issue => ctx.logger.warn(`agent-compare: ${issue.runId}: ${issue.message}`),
    });
    const present = async (record) => ({ ...publicView(record), control: await comparer.control(record) });
    const reconcileMemory = async () => {
        const latest = new Map();
        for (const record of await store.list()) {
            if (!record.sessionId)
                continue;
            const previous = latest.get(record.sessionId);
            if (!previous || record.updatedAt > previous.updatedAt)
                latest.set(record.sessionId, record);
        }
        await Promise.all([...latest.values()].map(record => memory.remember(record)));
    };
    ctx.effect(() => {
        const timer = setInterval(() => { void memory.retryUndelivered(id => store.load(id)).catch(error => ctx.logger.warn(`agent-compare: conversation retry failed: ${error.message}`)); }, 30000);
        timer.unref();
        void reconcileMemory().catch(error => ctx.logger.warn(`agent-compare: conversation restore failed: ${error.message}`));
        return () => clearInterval(timer);
    }, 'agent-compare: reconcile conversation memory');
    ctx.effect(() => () => comparer.dispose(), 'agent-compare: stop previews and candidates');
    const recovered = await comparer.recover();
    if (recovered.length > 0)
        ctx.logger.info(`agent-compare: settled ${recovered.length} unfinished run(s) after restart`);
    const repoFor = async (agent, signal) => {
        const wd = (agent.ctx.get('workingDirectory') ?? ctx.get('workingDirectory'));
        if (wd === undefined)
            throw new Error('workingDirectory 服务不可用，无法确定项目目录');
        return wd.ensure(agent, signal);
    };
    /** Freeze the parent's current route so a mid-run model switch cannot split the pair. */
    const currentRoute = (agent) => {
        return selectedRoute(agent);
    };
    const guard = (agent) => {
        if (isDelegated(agent))
            throw new HttpError(403, '候选或子 Agent 不能再发起比较');
    };
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'agent_compare_start',
        description: 'Build two independent implementations of one front-end task (UI layout, interaction, visual design) in isolated copies of the current Git repository, build and serve both apps, and run the same bound checks on each. ' +
            'Use it when the user asks to compare versions or wants to try two approaches before choosing; do not use it for bug fixes or refactors with a single right answer. ' +
            'Returns immediately after admission with a runId; generation, verification and previews continue in the conversation A|B card while the main conversation remains available. Saved comparison mode, models and time budget are reused unless explicitly overridden. The user then tries both live apps, picks one, and reviews adoption. Use agent_compare_status for progress; do not start another comparison to poll. Never claim which strategy produced which candidate before the user has chosen.',
        parameters: {
            task: { type: 'string', required: true, description: 'The complete task, as the user stated it, plus every requirement and constraint. Both candidates receive exactly this text.' },
            time_limit_minutes: { type: 'number', description: 'Optional per-candidate generation budget, 5 to 120 minutes; defaults to the saved conversation setting.' },
            mode: { type: 'string', enum: ['same-model', 'cross-model'], description: 'Optional override; defaults to the saved comparison mode. Cross-model uses the two saved model configurations.' },
        },
        output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        async execute(args, exec) {
            if (exec.agent === undefined)
                throw new Error('agent_compare_start must be called by an agent');
            if (isDelegated(exec.agent))
                return { error: 'A delegated or candidate agent cannot start another comparison.' };
            return startToolComparison(args, { ...exec, agent: exec.agent }, {
                preferences: sessionId => preferences.load(sessionId), currentRoute, repoFor,
                start: input => comparer.start(input),
            });
        },
    })), 'agent-compare: agent_compare_start tool');
    ctx.effect(() => ctx.tools.register(defineTool({
        name: 'agent_compare_status',
        description: 'Report the state of an AgentCompare run (or the latest one for this main conversation): candidate stages, checks, adoption eligibility, the user\'s choice and adoption result. Reconcile interruption and owned previews when a previous host has exited. Strategy names appear only after the user chose.',
        parameters: { run_id: { type: 'string', description: 'Run id; omit for the latest run of this conversation.' } },
        output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }] },
        async execute(args, exec) {
            const status = await readComparisonStatus(comparer, exec.agent, args.run_id, exec.signal);
            return 'error' in status ? status : { ...brief(status.record), control: status.control };
        },
    })), 'agent-compare: agent_compare_status tool');
    ctx.inject(['commands'], (sub) => {
        const commands = sub.commands;
        sub.effect(() => commands.register({
            name: 'ab',
            description: 'A|B 对比：同一需求做两版，真跑、验收、盲选，再采用到项目',
            input: { hint: '写下需求；模型、时长和示例在输入框上方选择' },
            handler: async ({ commandId, agent, rawInput, signal }) => {
                if (isDelegated(agent))
                    return { kind: 'error', text: '候选或子 Agent 不能再发起比较' };
                let input;
                let exampleKind = 'quick';
                try {
                    const ui = parseUiSubmission(rawInput);
                    const saved = ui?.preferences ?? await preferences.load(agent.session.id);
                    exampleKind = saved.exampleKind ?? 'quick';
                    input = ui ? { task: ui.task, example: ui.example } : parseAbInput(rawInput);
                    input = { ...input, minutes: input.minutes ?? saved.generationMinutes, ...(input.models === undefined && saved.mode === 'cross-model' ? { models: saved.models } : {}) };
                    if (input.models && input.models.some((m) => !m.provider || !m.model))
                        throw new Error('请在输入框上方选择两个完整的模型配置');
                    if (!input.models && !currentRoute(agent).model)
                        throw new Error('当前对话尚未选择模型，请先在输入框右下角选择模型。');
                }
                catch (error) {
                    return { kind: 'error', text: error.message };
                }
                if (!input.example && input.task === '')
                    return { kind: 'error', text: '请在输入框中写下要比较的需求，或点击「试跑示例」。' };
                try {
                    const r = await comparer.start({
                        repo: input.example ? await createExampleRepo(store.examplesDir, undefined, exampleKind) : await repoFor(agent, signal),
                        task: input.task === '' ? exampleTask(exampleKind) : input.task,
                        mode: input.models === undefined ? 'same-model' : 'cross-model',
                        routes: input.models ?? [currentRoute(agent), currentRoute(agent)],
                        hostContext: agent,
                        sessionId: agent.session.id,
                        origin: { kind: 'command', id: commandId },
                        ...(input.minutes === undefined ? {} : { generationMs: input.minutes * 60_000 }),
                    });
                    return { kind: 'success', text: commandResultText(r.runId) };
                }
                catch (error) {
                    return { kind: 'error', text: error.message };
                }
            },
        }), 'agent-compare: /ab command');
    });
    const runIdOf = (b) => {
        const id = b.runId;
        if (typeof id !== 'string' || !/^[0-9a-f]{8}$/.test(id))
            throw new HttpError(400, 'runId is required');
        return id;
    };
    const label = (v) => (v === 'A' || v === 'B' ? v : undefined);
    const resolveConversation = conversationResolver({ attached: () => agents?.list() ?? [], controller: () => ctx.get('sessionController'), guard });
    const agentFor = (b, signal) => resolveConversation(b.sessionId, signal);
    const view = async (runId) => {
        const r = await comparer.observe(runId);
        if (r === undefined)
            throw new HttpError(404, 'unknown run');
        return present(r);
    };
    const routeOf = (v) => {
        if (v === null || typeof v !== 'object')
            return undefined;
        const o = v;
        return typeof o.model === 'string' && o.model !== '' ? { ...(typeof o.provider === 'string' ? { provider: o.provider } : {}), model: o.model } : undefined;
    };
    const api = {
        async preferences(b, signal) {
            const agent = await agentFor(b, signal);
            return b.value === undefined ? preferences.load(agent.session.id) : preferences.save(agent.session.id, b.value);
        },
        async setup(b, signal) {
            const agent = await agentFor(b, signal);
            let project = { path: '', supported: false, reason: '当前对话没有项目目录，请打开 Git 项目，或试跑内置示例。' };
            const cwd = agent.session.header.cwd;
            if (cwd) {
                try {
                    const root = await repoRoot(cwd);
                    const info = await inspectProject(root);
                    project = { path: root, supported: info.kind === 'vite', ...(info.reason ? { reason: info.reason } : {}), ...(info.warning ? { warning: info.warning } : {}) };
                    if (project.supported && process.platform === 'win32' && info.packageManager === 'pnpm' && Number(info.packageManagerVersion?.split('.')[0]) >= 12) {
                        project = { path: root, supported: false, reason: '项目声明的 pnpm 12+ 在 Windows 上需要写入系统存储锁目录，当前宿主沙箱尚不支持；不会自动换版本或放宽权限。可试跑内置示例，需求草稿会保留。' };
                    }
                    if (project.supported) {
                        try {
                            projectCommandArgv([info.packageManager, '--version'], root, process.platform, { pnpm: bundledPnpm() });
                        }
                        catch {
                            project = { path: root, supported: false, reason: `未找到项目需要的 ${info.packageManager}。请在 DSH 所用环境中安装或启用该包管理器；需求草稿会保留。` };
                        }
                    }
                }
                catch {
                    project = { path: cwd, supported: false, reason: '当前目录不是 Git 仓库，请在 DSH 中打开项目，或选择内置示例。' };
                }
            }
            return { hostVersion: VERSION, pluginVersion: VERSION, dshVersion: await runtimeVersion, capabilities: await capabilities(), current: currentRoute(agent), project, generationMinutes: config.generationMinutes ?? DEFAULT_GENERATION_MS / 60_000 };
        },
        async list(b) {
            const page = await historyPage(store, b);
            return { ...page, runs: await Promise.all(page.runs.map(present)), isolation: runner.isolation };
        },
        async latest(b) {
            if (typeof b.sessionId !== 'string' || !b.sessionId.trim() || b.sessionId.length > 500)
                throw new HttpError(400, '会话编号无效');
            const record = (await store.list()).find(record => record.sessionId === b.sessionId);
            return record ? present(record) : null;
        },
        async get(b) { return view(runIdOf(b)); },
        async models(b, signal) {
            const agent = await agentFor(b, signal);
            const controller = (agent.ctx.get('sessionController') ?? ctx.get('sessionController'));
            if (controller) {
                const catalog = await controller.modelCatalog();
                if (!catalog.groups.length && catalog.failures.length)
                    throw new HttpError(503, `模型列表读取失败：${catalog.failures.map(p => p.name).join('、')}；可以返回同一模型模式或稍后重试。`);
                return { current: currentRoute(agent), models: catalog.groups.flatMap(p => p.models.map(m => ({ provider: p.id, providerName: p.name, id: m.id, name: m.name }))) };
            }
            const llm = (agent.ctx.get('llm') ?? ctx.get('llm'));
            const models = [];
            for (const p of llm?.listProviders() ?? []) {
                const listed = await llm.listModels(p.id);
                for (const m of listed)
                    models.push({ provider: p.id, providerName: p.name ?? p.id, id: m.id, name: m.name });
            }
            return { current: currentRoute(agent), models };
        },
        async start(b, signal) {
            const agent = await agentFor(b, signal);
            const task = typeof b.task === 'string' ? b.task : '';
            const mode = b.mode === 'cross-model' ? 'cross-model' : 'same-model';
            const pair = Array.isArray(b.models) ? b.models.map(routeOf) : [];
            if (mode === 'cross-model' && (pair[0] === undefined || pair[1] === undefined))
                throw new HttpError(400, '请选择两个模型');
            const routes = mode === 'cross-model' ? [pair[0], pair[1]] : [currentRoute(agent), currentRoute(agent)];
            const follows = typeof b.follows === 'string' && /^[0-9a-f]{8}$/.test(b.follows) ? b.follows : undefined;
            if (b.generationMinutes !== undefined && (typeof b.generationMinutes !== 'number' || !Number.isFinite(b.generationMinutes) || b.generationMinutes < 5 || b.generationMinutes > 120))
                throw new HttpError(400, '每版生成上限需要在 5 到 120 分钟之间');
            const minutes = b.generationMinutes;
            if (b.exampleKind !== undefined && b.exampleKind !== 'quick' && b.exampleKind !== 'full')
                throw new HttpError(400, '示例类型无效');
            const exampleKind = b.exampleKind === 'full' ? 'full' : 'quick';
            const repo = b.example === true ? await createExampleRepo(store.examplesDir, undefined, exampleKind) : await repoFor(agent, signal);
            const r = await comparer.start({
                repo,
                task: b.example === true && task.trim() === '' ? exampleTask(exampleKind) : task,
                mode,
                routes,
                hostContext: agent,
                sessionId: agent.session.id,
                ...(follows === undefined ? {} : { follows }),
                origin: { kind: 'panel' },
                ...(minutes === undefined ? {} : { generationMs: minutes * 60_000 }),
            });
            return present(r);
        },
        async reopenPreview(b) {
            const l = label(b.label);
            if (l === undefined)
                throw new HttpError(400, 'label must be A or B');
            return present(await comparer.reopenPreview(runIdOf(b), l));
        },
        async salvage(b) {
            const l = label(b.label);
            if (l === undefined)
                throw new HttpError(400, 'label must be A or B');
            return present(await comparer.salvage(runIdOf(b), l));
        },
        async retryVerification(b) {
            const l = label(b.label);
            if (l === undefined)
                throw new HttpError(400, 'label must be A or B');
            return present(await comparer.retryVerification(runIdOf(b), l));
        },
        async choose(b) {
            const pick = b.pick === 'none' ? 'none' : label(b.pick);
            if (pick === undefined)
                throw new HttpError(400, 'pick must be A, B or none');
            return present(await comparer.choose(runIdOf(b), pick, typeof b.note === 'string' ? b.note.slice(0, 500) : undefined));
        },
        async preflight(b) { return { ...await comparer.adoptPreflight(runIdOf(b)), protectedWorktreeApply: true }; },
        async adopt(b) { return present(await comparer.adopt(runIdOf(b), b.mode === 'branch' ? 'branch' : 'worktree')); },
        async cancelAdoption(b, signal) {
            const agent = await agentFor(b, signal);
            const runId = runIdOf(b), record = await comparer.get(runId);
            if (!record)
                throw new HttpError(404, '没有这次比较');
            if (record.sessionId && record.sessionId !== agent.session.id)
                throw new HttpError(409, '请回到这次比较所属的对话，停止采用预演。');
            return present(await comparer.cancelAdoption(runId));
        },
        async revert(b) { return present(await comparer.revert(runIdOf(b))); },
        async recover(b) { return present(await comparer.recoverAdoption(runIdOf(b), b.action === 'keep' ? 'keep' : 'restore')); },
        async cancel(b) { const r = await comparer.cancel(runIdOf(b), label(b.label)); return r === undefined ? null : present(r); },
        async cleanup(b, signal) { return api.releaseCopies(b, signal); },
        async copyCleanupPlan(b, signal) {
            const agent = await agentFor(b, signal);
            const runId = runIdOf(b), record = await comparer.get(runId);
            if (!record)
                throw new HttpError(404, '没有这次比较');
            return { ...await comparer.copyCleanupPlan(runId, signal), otherSession: !!record.sessionId && record.sessionId !== agent.session.id };
        },
        async releaseCopies(b, signal) {
            const agent = await agentFor(b, signal);
            const runId = runIdOf(b), record = await comparer.get(runId);
            if (!record)
                throw new HttpError(404, '没有这次比较');
            if (record.sessionId && record.sessionId !== agent.session.id && b.confirmOtherSession !== true)
                throw new HttpError(409, '这次比较属于另一个对话，请明确确认后再释放副本。');
            if (typeof b.token !== 'string')
                throw new HttpError(400, '请先查看本次副本清单');
            return present(await comparer.releaseCopies(runId, b.token));
        },
        async shot(b) {
            const r = await comparer.get(runIdOf(b));
            const c = r?.candidates.find((x) => x.label === label(b.label));
            const file = b.mobile === true ? c?.mobileScreenshot : c?.screenshot;
            if (file === undefined)
                throw new HttpError(404, 'no screenshot');
            return { dataUrl: `data:image/png;base64,${(await readFile(file)).toString('base64')}` };
        },
        async patch(b) {
            const r = await comparer.get(runIdOf(b));
            const c = r?.candidates.find((x) => x.label === label(b.label));
            if (r === undefined || c?.patchFile === undefined)
                throw new HttpError(404, 'no patch');
            if (r.revealedAt === undefined)
                throw new HttpError(403, '选择之后才能查看改动');
            const text = await readFile(c.patchFile, 'utf8');
            return { sha256: c.patchSha256, truncated: text.length > 400_000, text: text.slice(0, 400_000) };
        },
    };
    ctx.inject(['webServer', 'connection'], (web) => web.effect(() => web.webServer.register({
        kind: 'prefix',
        path: ROUTE,
        handler: async (req, res) => {
            if (web.connection.requestRejection(req) !== undefined)
                return json(res, 403, { ok: false, error: 'forbidden' });
            if (req.method !== 'POST')
                return json(res, 405, { ok: false, error: 'method not allowed' });
            const method = new URL(req.url ?? '/', 'http://dsh.internal').pathname.slice(ROUTE.length + 1);
            const handler = Object.hasOwn(api, method) ? api[method] : undefined;
            if (handler === undefined)
                return json(res, 404, { ok: false, error: `unknown method ${method}` });
            const ctl = new AbortController();
            res.once('close', () => { if (!res.writableEnded)
                ctl.abort(); });
            try {
                const body = await readBody(req);
                json(res, 200, { ok: true, value: await handler(body, ctl.signal) });
            }
            catch (error) {
                const status = error instanceof HttpError || error instanceof SessionAccessError ? error.status : error instanceof HistoryQueryError ? 400 : error instanceof RecordUnavailableError || error.name === 'BusyError' ? 409 : 500;
                json(res, status, { ok: false, error: error.message });
            }
        },
    }), 'agent-compare: /agent-compare/api routes'));
}
function json(res, status, body) {
    if (res.headersSent)
        return;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
}
