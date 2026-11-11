import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandHasMarkers, DiagnosticLog, killTree, spawnSpec, startLongRunning, Tail } from './proc.js';
import { prepareProjectProcess } from './project-process.js';
import { fetchPreview } from './preview-url.js';
import { inspectProject } from './project.js';
/** Ask the OS for a free loopback port. The caller still uses --strictPort, so a race fails loudly. */
export function freePort() {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            srv.close(() => (addr && typeof addr === 'object' ? resolve(addr.port) : reject(new Error('no port'))));
        });
    });
}
/**
 * The helper that serves static files and wraps script previews. It is plain
 * compiled CommonJS next to this module; from source (tests), the build output.
 */
export const PREVIEW_RUNNER = fileURLToPath(import.meta.url.endsWith('.ts')
    ? new URL('../../lib/core/preview-runner.cjs', import.meta.url)
    : new URL('./preview-runner.cjs', import.meta.url));
/** A persisted Yarn wrapper must name this exact project and preview port. */
export function isPreviewProcess(preview, commandLine, windows = process.platform === 'win32') {
    if (!commandHasMarkers(commandLine, [`--port ${preview.port}`], windows))
        return false;
    if (preview.kind === 'static' || preview.kind === 'script')
        return commandHasMarkers(commandLine, [PREVIEW_RUNNER], windows);
    if (preview.launcher !== 'yarn')
        return commandHasMarkers(commandLine, [path.join(preview.cwd, 'node_modules', 'vite', 'bin', 'vite.js')], windows);
    const cwd = [`--cwd ${preview.cwd}`, `--cwd "${preview.cwd}"`, `--cwd '${preview.cwd}'`];
    return cwd.some(marker => commandHasMarkers(commandLine, [marker], windows)) && commandHasMarkers(commandLine, ['exec vite'], windows);
}
export class PreviewError extends Error {
    log;
    constructor(message, log) {
        super(message);
        this.log = log;
        this.name = 'PreviewError';
    }
}
const SUCCESS = (status) => status >= 200 && status < 300;
/** Any answer short of a server error means a project server is up (it may redirect or have no root page). */
const ANSWERING = (status) => status >= 200 && status < 500;
async function httpReady(url, signal, accept = SUCCESS) {
    try {
        const res = await fetchPreview(url, { signal });
        await res.body?.cancel();
        return accept(res.status);
    }
    catch {
        return false;
    }
}
/**
 * Serve a copy on a dedicated loopback port and return only after it answers
 * HTTP. `build` serves the output of the build the checks just ran (`vite
 * preview`), so what the user tries is the artifact that passed; `dev` runs the
 * dev server and is used only when there is no build to serve. The Vite binary
 * runs on the host Node directly, except modern Yarn's project-aware loader;
 * its wrapper and the complete child tree share this preview's lifecycle.
 */
export async function startVitePreview(dir, opts = {}) {
    const viteBin = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
    const project = await inspectProject(dir);
    const modernYarn = project.packageManager === 'yarn' && project.modernYarn === true;
    if (!modernYarn && !existsSync(viteBin))
        throw new PreviewError('副本里没有安装 vite', '');
    const kind = opts.kind ?? 'build';
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const host = `ac-${randomBytes(16).toString('hex')}.localhost`;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        const port = await freePort();
        const root = `http://${host}:${port}/`;
        const args = kind === 'build' ? ['preview'] : [];
        const command = modernYarn ? ['yarn', '--cwd', dir, 'exec', 'vite'] : ['node', viteBin];
        const prepared = await prepareProjectProcess({ argv: [...command, ...args, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], cwd: dir,
            env: { BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1' }, signal: opts.signal }, opts.prepareProjectProcess);
        const child = startLongRunning(prepared.argv, {
            cwd: dir,
            env: prepared.env,
        });
        const log = new DiagnosticLog(6000);
        let closed = false;
        const exit = new Promise((resolve) => child.once('close', () => { closed = true; resolve(); }));
        child.stdout?.setEncoding('utf8').on('data', (d) => log.push(d));
        child.stderr?.setEncoding('utf8').on('data', (d) => { log.push(d); prepared.observeStderr?.(d); });
        const entry = () => {
            const printed = new RegExp(`http://127\\.0\\.0\\.1:${port}/[^\\s\\u001b]*`).exec(log.toString())?.[0];
            const url = new URL(printed ?? root);
            url.hostname = host;
            return url.href;
        };
        const outcome = await waitReady(child, entry, timeoutMs, opts.signal);
        if (outcome === 'ready' && child.pid !== undefined) {
            const pid = child.pid;
            let stopping;
            return { url: entry(), port, pid, log, ...(modernYarn ? { launcher: 'yarn' } : {}), stop: () => closed ? Promise.resolve() : stopping ??= (async () => {
                    try {
                        await killTree(pid);
                    }
                    finally {
                        if (!closed && child.exitCode === null && child.signalCode === null)
                            child.kill('SIGKILL');
                    }
                    let timer;
                    try {
                        await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`预览进程 ${pid} 未在终止后退出`)), 5000); })]);
                    }
                    finally {
                        if (timer)
                            clearTimeout(timer);
                    }
                })().catch((error) => { stopping = undefined; throw error; }) };
        }
        try {
            await killTree(child.pid);
        }
        finally {
            if (!closed && child.exitCode === null && child.signalCode === null)
                child.kill('SIGKILL');
        }
        lastError = new PreviewError(outcome === 'exited' ? '预览服务在响应前退出' : outcome === 'aborted' ? 'cancelled' : `预览服务 ${Math.round(timeoutMs / 1000)} 秒内没有响应`, log.toString());
        if (outcome === 'aborted')
            break;
        // A port taken between probe and bind shows up as an early exit; retry with a new port.
        if (outcome !== 'exited' || !/(EADDRINUSE|port .* (in use|already))/i.test(log.toString()))
            break;
    }
    throw lastError ?? new PreviewError('预览服务启动失败', '');
}
/**
 * Serve a folder of static files (an `index.html` page, or another entry
 * page) through the preview helper. No project code runs; the helper only
 * reads files inside `dir`.
 */
export function startStaticPreview(dir, entry, opts = {}) {
    if (!entry || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..'))
        return Promise.reject(new PreviewError('静态页面入口无效', ''));
    return startHelperPreview(dir, opts, async (port) => ({
        argv: [process.execPath, PREVIEW_RUNNER, 'static', '--port', String(port), '--cwd', dir, '--entry', entry],
        env: helperEnvironment(),
    }));
}
/**
 * Run a project's own `dev` or `start` script as a preview. The script runs
 * inside the host's process boundary like every other project command; the
 * helper only owns its process tree. `PORT` and `HOST` ask the server for this
 * preview's loopback port; a server that ignores them never answers there and
 * the preview ends as "no live page".
 */
export function startScriptPreview(dir, command, opts = {}) {
    return startHelperPreview(dir, opts, async (port) => {
        const prepared = await prepareProjectProcess({ argv: command, cwd: dir, signal: opts.signal,
            env: { PORT: String(port), HOST: '127.0.0.1', HOSTNAME: '127.0.0.1', BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' } }, opts.prepareProjectProcess);
        // Resolve the confined command exactly as other project processes are spawned.
        const spec = spawnSpec(prepared.argv);
        return {
            argv: [process.execPath, PREVIEW_RUNNER, 'script', '--port', String(port), '--cwd', dir, ...(spec.shell ? ['--shell', '--', spec.file] : ['--', spec.file, ...spec.args])],
            env: { ...prepared.env, ...helperEnvironment() },
            ...(prepared.observeStderr ? { observeStderr: prepared.observeStderr } : {}),
        };
    });
}
/** The helper runs on the host's own runtime, which may be Electron. */
function helperEnvironment() {
    return { ELECTRON_RUN_AS_NODE: '1', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) };
}
async function startHelperPreview(dir, opts, launch) {
    if (!existsSync(PREVIEW_RUNNER))
        throw new PreviewError('预览辅助进程缺失，请重新安装插件', '');
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const host = `ac-${randomBytes(16).toString('hex')}.localhost`;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        opts.signal?.throwIfAborted();
        const port = await freePort();
        const launched = await launch(port);
        const child = startLongRunning(launched.argv, { cwd: dir, env: launched.env });
        const log = new DiagnosticLog(6000);
        let closed = false;
        const exit = new Promise((resolve) => child.once('close', () => { closed = true; resolve(); }));
        child.stdout?.setEncoding('utf8').on('data', (d) => log.push(d));
        child.stderr?.setEncoding('utf8').on('data', (d) => { log.push(d); launched.observeStderr?.(d); });
        const url = `http://${host}:${port}/`;
        const outcome = await waitReady(child, () => url, timeoutMs, opts.signal, ANSWERING);
        if (outcome === 'ready' && child.pid !== undefined) {
            const pid = child.pid;
            let stopping;
            return { url, port, pid, log, stop: () => closed ? Promise.resolve() : stopping ??= (async () => {
                    try {
                        await killTree(pid);
                    }
                    finally {
                        if (!closed && child.exitCode === null && child.signalCode === null)
                            child.kill('SIGKILL');
                    }
                    let timer;
                    try {
                        await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`预览进程 ${pid} 未在终止后退出`)), 5000); })]);
                    }
                    finally {
                        if (timer)
                            clearTimeout(timer);
                    }
                })().catch((error) => { stopping = undefined; throw error; }) };
        }
        try {
            await killTree(child.pid);
        }
        finally {
            if (!closed && child.exitCode === null && child.signalCode === null)
                child.kill('SIGKILL');
        }
        lastError = new PreviewError(outcome === 'exited' ? '预览服务在响应前退出' : outcome === 'aborted' ? 'cancelled' : `预览服务 ${Math.round(timeoutMs / 1000)} 秒内没有在指定端口响应`, log.toString());
        if (outcome === 'aborted')
            break;
        if (outcome !== 'exited' || !/(EADDRINUSE|port .* (in use|already))/i.test(log.toString()))
            break;
    }
    throw lastError ?? new PreviewError('预览服务启动失败', '');
}
function waitReady(child, url, timeoutMs, signal, accept = SUCCESS) {
    return new Promise((resolve) => {
        let done = false;
        const ctl = new AbortController();
        const finish = (r) => {
            if (done)
                return;
            done = true;
            ctl.abort();
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            resolve(r);
        };
        const onAbort = () => finish('aborted');
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => finish('timeout'), timeoutMs);
        child.once('exit', () => finish('exited'));
        child.once('error', () => finish('exited'));
        const poll = async () => {
            while (!done) {
                if (await httpReady(url(), ctl.signal, accept))
                    return finish('ready');
                await new Promise((r) => setTimeout(r, 300));
            }
        };
        if (signal?.aborted)
            onAbort();
        else
            void poll();
    });
}
