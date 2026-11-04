/** A background comparison takes ownership only after start has admitted it. */
export async function startToolComparison(args, exec, ports) {
    exec.signal.throwIfAborted();
    if (typeof args.task !== 'string' || !args.task.trim())
        throw new Error('请提供要比较的完整需求');
    if (args.mode !== undefined && !['same-model', 'cross-model'].includes(args.mode))
        throw new Error('比较方式无效');
    const saved = await ports.preferences(exec.agent.session.id);
    const minutes = args.time_limit_minutes ?? saved.generationMinutes;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 5 || minutes > 120)
        throw new Error('每版生成上限需要在 5 到 120 分钟之间');
    const mode = args.mode ?? saved.mode;
    const current = ports.currentRoute(exec.agent);
    const routes = mode === 'cross-model' ? saved.models : [current, current];
    if (routes.some(route => !route.model || (mode === 'cross-model' && !route.provider)))
        throw new Error(mode === 'cross-model' ? '请在比较设置中选择两个完整的模型配置' : '当前对话尚未选择模型');
    if (mode === 'cross-model' && routes[0].provider === routes[1].provider && routes[0].model === routes[1].model)
        throw new Error('两个模型模式需要不同的模型配置');
    const repo = await ports.repoFor(exec.agent, exec.signal);
    exec.signal.throwIfAborted();
    const started = await ports.start({
        repo, task: args.task, mode, routes, hostContext: exec.agent,
        sessionId: exec.agent.session.id,
        origin: { kind: 'tool', ...(exec.callId ? { id: exec.callId } : {}) },
        generationMs: minutes * 60_000,
    });
    // No listener on the short-lived tool signal: the admitted run has explicit
    // comparison cancellation and the host-lifetime cleanup already owns it.
    return {
        runId: started.runId, state: started.state, background: true,
        next: 'The comparison is running in this conversation\'s A|B card. Its results, choice and adoption are recorded automatically. The main conversation can continue. Use agent_compare_status for progress and the card\'s controls to stop the comparison. Do not start another run to poll or guess the hidden strategies.',
    };
}
