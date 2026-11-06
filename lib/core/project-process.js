import { run } from './proc.js';
export async function prepareProjectProcess(request, prepare) {
    request.signal?.throwIfAborted();
    if (prepare === undefined)
        throw new Error('项目命令没有可用的写入边界。请更新宿主并启用其进程沙箱；不会尝试无约束执行。');
    const prepared = await prepare(request);
    request.signal?.throwIfAborted();
    if (!Array.isArray(prepared.argv) || !prepared.argv[0] || prepared.argv.some(a => typeof a !== 'string' || a.includes('\0')))
        throw new Error('宿主返回了无效的受限命令');
    if (prepared.env === null || typeof prepared.env !== 'object' || Array.isArray(prepared.env) || Object.entries(prepared.env).some(([key, value]) => key.includes('\0') || key.includes('=') || (value !== undefined && (typeof value !== 'string' || value.includes('\0')))))
        throw new Error('宿主没有提供有效的子进程环境；拒绝继承宿主环境执行');
    return prepared;
}
/** Every installation and acceptance command must cross the same host boundary. */
export async function runProjectProcess(argv, opts, prepare) {
    const prepared = await prepareProjectProcess({ argv, cwd: opts.cwd, env: opts.env, signal: opts.signal }, prepare);
    const result = await run(prepared.argv, { ...opts, env: prepared.env });
    prepared.observeStderr?.(result.stderr);
    return result;
}
