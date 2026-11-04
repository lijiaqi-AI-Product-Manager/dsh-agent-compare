import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const isWin = process.platform === 'win32';
/** Keep the initial failure explanation as well as the final diagnostic lines. */
export function diagnosticText(text, max = 1500) {
    if (text.length <= max)
        return text;
    const marker = '\n…\n';
    const head = Math.ceil((max - marker.length) / 2);
    return text.slice(0, head) + marker + text.slice(-(max - marker.length - head));
}
/** Keep at most `max` trailing characters of a growing log. */
export class Tail {
    max;
    buf = '';
    constructor(max = 4000) {
        this.max = max;
    }
    push(chunk) {
        this.buf += chunk;
        if (this.buf.length > this.max * 2)
            this.buf = this.buf.slice(-this.max);
    }
    toString() {
        return this.buf.length > this.max ? this.buf.slice(-this.max) : this.buf;
    }
}
/** Bounded preview diagnostics retaining the first error instead of only its stack tail. */
export class DiagnosticLog extends Tail {
    limit;
    prefix = '';
    total = 0;
    constructor(limit = 6000) {
        super(limit);
        this.limit = limit;
    }
    push(chunk) {
        this.prefix = (this.prefix + chunk).slice(0, Math.ceil(this.limit / 2));
        this.total += chunk.length;
        super.push(chunk);
    }
    toString() {
        const tail = super.toString();
        return this.total <= this.limit ? tail : diagnosticText(this.prefix + tail, this.limit);
    }
}
/** A stop request did not establish that the whole process tree exited. */
export class ProcessStopError extends Error {
    pid;
    constructor(pid) {
        super(`无法确认任务进程${pid === undefined ? '' : ` ${pid}`}及其子进程已停止；已停止等待，请保留副本并检查任务进程后再清理`);
        this.pid = pid;
        this.name = 'ProcessStopError';
    }
}
/**
 * Resolve an executable on PATH. On Windows this honours PATHEXT, so `npm`
 * resolves to `npm.cmd`. Returns undefined when nothing matches.
 */
export function which(command, envPath = process.env.PATH ?? process.env.Path ?? '') {
    if (path.isAbsolute(command))
        return existsSync(command) ? command : undefined;
    const exts = isWin ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
    for (const dir of envPath.split(path.delimiter)) {
        if (dir === '')
            continue;
        for (const ext of isWin && path.extname(command) === '' ? exts : ['']) {
            const candidate = path.join(dir.replace(/^"|"$/g, ''), command + ext.toLowerCase());
            if (existsSync(candidate))
                return candidate;
            const upper = path.join(dir.replace(/^"|"$/g, ''), command + ext);
            if (existsSync(upper))
                return upper;
        }
    }
    return undefined;
}
/** Quote one argument for cmd.exe. Only used for `.cmd`/`.bat` shims. */
function quoteCmdArg(arg) {
    if (arg === '')
        return '""';
    if (!/[\s"&|<>^%!()]/.test(arg))
        return arg;
    return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1').replace(/%/g, '%%')}"`;
}
/**
 * Build a spawn spec that works for real executables and Windows `.cmd` shims.
 * Node refuses to spawn `.cmd` files without a shell (CVE-2024-27980), so shims
 * go through cmd.exe with every argument quoted.
 */
export function spawnSpec(argv) {
    const [cmd, ...rest] = argv;
    if (cmd === undefined)
        throw new Error('empty argv');
    const resolved = cmd === 'node' ? process.execPath : (which(cmd) ?? cmd);
    if (isWin && /\.(cmd|bat)$/i.test(resolved)) {
        return { file: [resolved, ...rest].map(quoteCmdArg).join(' '), args: [], shell: true };
    }
    return { file: resolved, args: rest, shell: false };
}
/** Run a command to completion, capturing bounded output. Never throws on non-zero exit. */
export function run(argv, opts) {
    return new Promise((resolve, reject) => {
        let spec;
        try {
            spec = spawnSpec(argv);
        }
        catch (error) {
            reject(error);
            return;
        }
        const max = opts.maxOutput ?? 1_000_000;
        const child = spawn(spec.file, spec.args, {
            cwd: opts.cwd,
            env: opts.env ?? process.env,
            shell: spec.shell,
            windowsHide: true,
            detached: !isWin,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let aborted = false;
        let truncated = false;
        let closed = false;
        let stopping;
        let stopTimer;
        let finished = false;
        child.stdout?.setEncoding('utf8').on('data', (d) => {
            if (stdout.length + d.length <= max)
                stdout += d;
            else
                truncated = true;
        });
        child.stderr?.setEncoding('utf8').on('data', (d) => {
            if (stderr.length + d.length <= max)
                stderr += d;
            else {
                stderr = (stderr + d).slice(-max);
                truncated = true;
            }
        });
        if (opts.input !== undefined)
            child.stdin?.end(opts.input);
        else
            child.stdin?.end();
        const clear = () => {
            finished = true;
            if (timer)
                clearTimeout(timer);
            if (stopTimer)
                clearTimeout(stopTimer);
            opts.signal?.removeEventListener('abort', onAbort);
        };
        const fail = (error) => { if (!finished) {
            clear();
            reject(error);
        } };
        const stop = () => {
            if (stopping || finished)
                return;
            if (timer)
                clearTimeout(timer);
            // A parent may have exited while a descendant still holds its pipes.
            // Its old numeric PID is no longer authority to terminate a process.
            stopping = Promise.resolve().then(async () => {
                if (child.exitCode !== null || child.signalCode !== null)
                    throw new ProcessStopError(child.pid);
                await killTree(child.pid);
            }).catch(error => {
                if (child.exitCode === null && child.signalCode === null)
                    child.kill('SIGKILL');
                throw error;
            });
            void stopping.catch(error => {
                child.stdin?.destroy();
                child.stdout?.destroy();
                child.stderr?.destroy();
                fail(error);
            });
            stopTimer = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null)
                    child.kill('SIGKILL');
                child.stdin?.destroy();
                child.stdout?.destroy();
                child.stderr?.destroy();
                fail(new ProcessStopError(child.pid));
            }, 5000);
        };
        const timer = opts.timeoutMs === undefined ? undefined : setTimeout(() => {
            timedOut = true;
            stop();
        }, opts.timeoutMs);
        const onAbort = () => {
            aborted = true;
            stop();
        };
        opts.signal?.addEventListener('abort', onAbort, { once: true });
        if (opts.signal?.aborted)
            onAbort();
        child.on('error', (error) => {
            fail(stopping ? new ProcessStopError(child.pid) : error);
        });
        child.on('close', (code) => {
            closed = true;
            const complete = () => {
                if (finished || !closed)
                    return;
                clear();
                resolve({ code, stdout, stderr, timedOut, aborted, truncated });
            };
            // Completion of taskkill, rather than the parent's close event alone,
            // establishes that tree termination was attempted successfully.
            if (stopping)
                void stopping.then(complete, fail);
            else
                complete();
        });
    });
}
/** Run and throw with a bounded message unless the exit code is 0. */
export async function runOk(argv, opts) {
    const r = await run(argv, opts);
    if (r.code !== 0) {
        const detail = (r.stderr || r.stdout).trim().slice(-1500);
        throw new Error(`${argv.slice(0, 3).join(' ')} exited ${r.code ?? (r.timedOut ? 'timeout' : 'signal')}: ${detail}`);
    }
    if (r.truncated)
        throw new Error(`${argv.slice(0, 3).join(' ')} produced more than ${opts.maxOutput ?? 1_000_000} characters of output`);
    return r.stdout;
}
/**
 * Terminate a process and all of its descendants. On Windows `taskkill /T`
 * walks the tree (shims spawn grandchildren); elsewhere children were started
 * in their own process group, so the group is signalled.
 */
export async function killTree(pid) {
    if (pid === undefined)
        return;
    if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error('invalid process id');
    if (isWin) {
        if (!isAlive(pid))
            return;
        let succeeded = false;
        await new Promise((resolve) => {
            const k = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
            let done = false;
            const finish = () => { if (!done) {
                done = true;
                clearTimeout(timer);
                resolve();
            } };
            const timer = setTimeout(() => { k.kill('SIGKILL'); finish(); }, 3000);
            k.once('close', code => { if (code === 0 || !isAlive(pid))
                succeeded = true; finish(); });
            k.once('error', finish);
        });
        if (!succeeded)
            throw new ProcessStopError(pid);
        return;
    }
    let target = -pid;
    try {
        process.kill(target, 'SIGTERM');
    }
    catch {
        target = pid;
        try {
            process.kill(target, 'SIGTERM');
        }
        catch {
            return;
        }
    }
    // Commands can ignore TERM. Bound the grace period, then terminate
    // the original process group so cancellation cannot wait forever on its pipes.
    const until = Date.now() + 500;
    while (Date.now() < until) {
        try {
            process.kill(target, 0);
        }
        catch {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    try {
        process.kill(target, 'SIGKILL');
    }
    catch {
        // The original process or group has already gone.
    }
}
/** True when a pid currently names a live process. */
export function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === 'EPERM';
    }
}
/** A missing observation is uncertainty, never proof that a process exited. */
export async function observeProcess(pid, timeoutMs = 15_000) {
    if (!Number.isInteger(pid) || pid <= 0 || !isAlive(pid))
        return { state: 'gone' };
    const argv = isWin
        ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`]
        : ['ps', '-o', 'args=', '-p', String(pid)];
    try {
        const r = await run(argv, { cwd: process.cwd(), timeoutMs });
        const line = r.stdout.trim();
        if (r.code === 0 && line !== '')
            return { state: 'observed', commandLine: line };
        if (!isAlive(pid))
            return { state: 'gone' };
        return { state: 'unavailable', reason: r.timedOut ? '读取进程命令行超时' : '当前无法读取进程命令行' };
    }
    catch {
        return isAlive(pid) ? { state: 'unavailable', reason: '当前无法读取进程命令行' } : { state: 'gone' };
    }
}
/** The command line when observation succeeded; callers needing certainty use observeProcess. */
export async function processCommandLine(pid) {
    const observed = await observeProcess(pid);
    return observed.state === 'observed' ? observed.commandLine : undefined;
}
/**
 * True only when `pid` is alive AND its command line names every marker (for
 * a preview: the copy's vite binary path and its port). A recycled pid that now
 * belongs to something else fails this, so it is never killed.
 */
export async function ownsProcess(pid, markers) {
    const line = await processCommandLine(pid);
    return line !== undefined && commandHasMarkers(line, markers);
}
/** Complete command markers, including numeric-port boundaries. */
export function commandHasMarkers(line, markers, windows = isWin) {
    const norm = (s) => (windows ? s.replace(/\//g, '\\').toLowerCase() : s);
    const command = norm(line);
    return markers.length > 0 && markers.every((m) => {
        const marker = norm(m);
        if (!marker)
            return false;
        let at = command.indexOf(marker);
        while (at >= 0) {
            const end = at + marker.length;
            if ((at === 0 || /[\s"']/.test(command[at - 1])) && (end === command.length || /[\s"']/.test(command[end])))
                return true;
            at = command.indexOf(marker, at + 1);
        }
        return false;
    });
}
/** Wait until `pid` has exited; false when it is still alive after `timeoutMs`. */
export async function waitGone(pid, timeoutMs = 5000) {
    const until = Date.now() + timeoutMs;
    while (isAlive(pid)) {
        if (Date.now() > until)
            return false;
        await new Promise((r) => setTimeout(r, 100));
    }
    return true;
}
/** Start a long-running process with streaming output. The caller owns its lifetime. */
export function startLongRunning(argv, opts) {
    const spec = spawnSpec(argv);
    return spawn(spec.file, spec.args, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        shell: spec.shell,
        windowsHide: true,
        detached: !isWin,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}
