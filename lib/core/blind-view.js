function checksOf(checks) {
    return checks?.map(({ tail: _tail, reason, steps, ...facts }) => ({
        ...facts, tail: '',
        ...(reason === undefined ? {} : { reason: facts.outcome === 'skipped' ? '检查未运行；详细说明在揭晓后显示' : facts.outcome === 'passed' ? '检查已完成；详细日志在揭晓后显示' : '检查未通过；详细日志在揭晓后显示' }),
        ...(steps ? { steps: steps.map(({ label, ok }) => ({ label, ok })) } : {}),
    }));
}
function installOf(install) {
    if (!install)
        return undefined;
    const safe = { ...install };
    if (install.failure) {
        const { diagnostic: _diagnostic, ...failure } = install.failure;
        safe.failure = failure;
    }
    if (install.runtime) {
        const { windowsProcessCompat: _compatibility, ...runtime } = install.runtime;
        safe.runtime = runtime;
    }
    return safe;
}
function errorOf(error) {
    if (!error)
        return undefined;
    if (error.stage === 'preparing' && /^项目包管理器未就绪：(npm|pnpm|yarn) /.test(error.message))
        return { stage: error.stage, message: error.message.split('\n')[0] };
    // The no-change message is produced by the sealer; candidate prose follows
    // a distinct separator. Keep its factual first part without the explanation.
    if (error.stage === 'sealing' && error.message.includes('\nAgent 的说明：'))
        return { ...error, message: error.message.split('\nAgent 的说明：')[0] };
    const labels = { preparing: '副本准备', generating: '生成', sealing: '改动封存', installing: '依赖安装', verifying: '检查与构建', previewing: '页面启动与验收' };
    return { stage: error.stage, message: `${labels[error.stage] ?? '当前步骤'}未能完成；阶段与检查结果已保留，详细说明在揭晓后显示。` };
}
/** Evidence safe for an active blind comparison; the durable record stays intact. */
export function blindEvidence(candidate) {
    const { progress, generation, verdict } = candidate;
    return {
        ...(candidate.install ? { install: installOf(candidate.install) } : {}),
        ...(candidate.checks ? { checks: checksOf(candidate.checks) } : {}),
        ...(candidate.error ? { error: errorOf(candidate.error) } : {}),
        ...(candidate.verificationHistory ? { verificationHistory: candidate.verificationHistory.map((attempt) => ({
                recordedAt: attempt.recordedAt,
                ...(attempt.durationMs === undefined ? {} : { durationMs: attempt.durationMs }),
                ...(attempt.install ? { install: installOf(attempt.install) } : {}),
                ...(attempt.checks ? { checks: checksOf(attempt.checks) } : {}),
                ...(attempt.error ? { error: errorOf(attempt.error) } : {}),
            })) } : {}),
        ...(progress ? { progress: { steps: progress.steps, lastActivityAt: progress.lastActivityAt, ...(progress.lastAction ? { lastAction: '正在处理项目' } : {}) } } : {}),
        ...(generation ? { generation: { ended: generation.ended } } : {}),
        ...(verdict ? { verdict: {
                eligible: verdict.eligible,
                reasons: verdict.reasons.map(reason => reason.startsWith('改动了验收相关文件：') ? '改动了验收相关文件；详细路径在揭晓后显示' : reason.startsWith('验收过程中副本多出了未封存的改动：') ? '验收过程中副本多出了未封存的改动；详细路径在揭晓后显示' : reason),
                warnings: verdict.warnings.map(warning => warning.startsWith('Agent 没有正常结束') ? 'Agent 没有正常结束；以上结论针对已写的文件' : warning.startsWith('页面加载检查没有运行') ? '页面加载检查没有运行；详细说明在揭晓后显示' : warning),
            } } : {}),
    };
}
