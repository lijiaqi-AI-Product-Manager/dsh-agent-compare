import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { commandHasMarkers, DiagnosticLog, killTree, startLongRunning, Tail } from './proc.js';
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
/** A persisted Yarn wrapper must name this exact project and preview port. */
export function isPreviewProcess(preview, commandLine, windows = process.platform === 'win32') {
    if (!commandHasMarkers(commandLine, [`--port ${preview.port}`], windows))
        return false;
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
async function httpReady(url, signal) {
    try {
        const res = await fetchPreview(url, { signal });
        await res.body?.cancel();
        return res.status >= 200 && res.status < 300;
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
        if (outcome !== 'exited' || !/port .* (in use|already)/i.test(log.toString()))
            break;
    }
    throw lastError ?? new PreviewError('预览服务启动失败', '');
}
function waitReady(child, url, timeoutMs, signal) {
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
                if (await httpReady(url(), ctl.signal))
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
