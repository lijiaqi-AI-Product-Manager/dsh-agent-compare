import { comparisonPlan } from './preferences.js';
/** A background comparison takes ownership only after start has admitted it. */
export async function startToolComparison(args, exec, ports) {
    exec.signal.throwIfAborted();
    if (typeof args.task !== 'string' || !args.task.trim())
        throw new Error('请提供要比较的完整需求');
    if (args.mode !== undefined && !['same-model', 'cross-model'].includes(args.mode))
        throw new Error('比较方式无效');
    if (args.versions !== undefined && (!Number.isSafeInteger(args.versions) || args.versions < 2 || args.versions > 4))
        throw new Error('版本数需要在 2 到 4 之间');
    const saved = await ports.preferences(exec.agent.session.id);
    const minutes = args.time_limit_minutes ?? saved.generationMinutes;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 5 || minutes > 120)
        throw new Error('每版生成上限需要在 5 到 120 分钟之间');
    const plan = comparisonPlan(saved, ports.currentRoute(exec.agent), { ...(args.mode ? { mode: args.mode } : {}), ...(args.versions ? { versions: args.versions } : {}) });
    const repo = await ports.repoFor(exec.agent, exec.signal);
    exec.signal.throwIfAborted();
    const conversationContext = await ports.conversationContext?.(exec.agent, saved);
    exec.signal.throwIfAborted();
    const started = await ports.start({
        ...(conversationContext ? { conversationContext } : {}),
        repo, task: args.task, ...plan, hostContext: exec.agent,
        sessionId: exec.agent.session.id,
        origin: { kind: 'tool', ...(exec.callId ? { id: exec.callId } : {}) },
        generationMs: minutes * 60_000,
        windowsProcessCompat: saved.windowsProcessCompat ?? 'auto',
    });
    // No listener on the short-lived tool signal: the admitted run has explicit
    // comparison cancellation and the host-lifetime cleanup already owns it.
    return {
        runId: started.runId, state: started.state, background: true,
        next: `The comparison of ${plan.candidates} versions is running in this conversation's A|B card. Its results, choice and adoption are recorded automatically. The main conversation can continue. Use agent_compare_status for progress and the card's controls to stop the comparison. Do not start another run to poll${plan.blind ? ' or guess the hidden styles' : ''}.`,
    };
}
