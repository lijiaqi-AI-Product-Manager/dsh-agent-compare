"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preview processes AgentCompare starts for projects that are not Vite.
 *
 *   node preview-runner.cjs static --port <port> --cwd <dir> --entry <file>
 *     Serves the files below <dir> on 127.0.0.1:<port>. It never lists
 *     directories, never serves a path whose real location is outside <dir>,
 *     and sends no-store caching so a reload shows the sealed files.
 *
 *   node preview-runner.cjs script --port <port> --cwd <dir> -- <argv...>
 *     Runs an already-confined project command as its child. The preview then
 *     has one recognisable process whose whole tree can be stopped.
 *
 * The command line carries this file's path and `--port <port>`, which is how
 * a later host proves a recorded preview process is this one before stopping it.
 */
const cp = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.wasm': 'application/wasm', '.pdf': 'application/pdf',
};
function parse(argv) {
    const [mode, ...rest] = argv;
    if (mode !== 'static' && mode !== 'script')
        throw new Error('usage: preview-runner.cjs static|script --port <port> --cwd <dir> ...');
    const options = { mode, shell: false, command: [] };
    for (let i = 0; i < rest.length; i++) {
        const key = rest[i];
        if (key === '--') {
            options.command = rest.slice(i + 1);
            break;
        }
        // A Windows command shim arrives as one quoted command line for the shell.
        if (key === '--shell') {
            options.shell = true;
            continue;
        }
        const value = rest[++i];
        if (value === undefined)
            throw new Error(`missing value for ${key}`);
        if (key === '--port')
            options.port = Number(value);
        else if (key === '--cwd')
            options.cwd = value;
        else if (key === '--entry')
            options.entry = value;
        else
            throw new Error(`unknown option ${key}`);
    }
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535)
        throw new Error('invalid --port');
    if (!options.cwd || !path.isAbsolute(options.cwd))
        throw new Error('--cwd must be an absolute directory');
    if (mode === 'script' && options.command.length === 0)
        throw new Error('script mode needs a command after --');
    return options;
}
/** The served file for a request path, or undefined when it must not be served. */
function resolveRequest(root, entry, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    }
    catch {
        return undefined;
    }
    if (decoded.includes('\0'))
        return undefined;
    const relative = decoded.replace(/^\/+/, '');
    let file = path.resolve(root, relative === '' ? entry : relative);
    const inside = path.relative(root, file);
    if (inside.startsWith('..') || path.isAbsolute(inside))
        return undefined;
    let stat;
    try {
        stat = fs.statSync(file);
    }
    catch {
        return undefined;
    }
    if (stat.isDirectory()) {
        file = path.join(file, 'index.html');
        try {
            stat = fs.statSync(file);
        }
        catch {
            return undefined;
        }
    }
    if (!stat.isFile())
        return undefined;
    // A link inside the copy must not expose files outside it.
    let real;
    try {
        real = fs.realpathSync.native(file);
    }
    catch {
        return undefined;
    }
    const realInside = path.relative(root, real);
    if (realInside.startsWith('..') || path.isAbsolute(realInside))
        return undefined;
    return real;
}
function serveStatic(options) {
    const root = fs.realpathSync.native(options.cwd);
    const entry = options.entry && !path.isAbsolute(options.entry) ? options.entry : 'index.html';
    const server = http.createServer((request, response) => {
        const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { ...headers, allow: 'GET, HEAD' }).end();
            return;
        }
        let pathname = '/';
        try {
            pathname = new URL(request.url ?? '/', 'http://preview.invalid').pathname;
        }
        catch { /* keep the entry */ }
        const file = resolveRequest(root, entry, pathname);
        if (file === undefined) {
            response.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
            return;
        }
        const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
        const size = fs.statSync(file).size;
        response.writeHead(200, { ...headers, 'content-type': type, 'content-length': String(size) });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    });
    server.on('error', error => { process.stderr.write(`preview server error: ${error.message}\n`); process.exit(1); });
    server.listen(options.port, '127.0.0.1', () => { process.stdout.write(`serving http://127.0.0.1:${options.port}/\n`); });
}
function runScript(options) {
    const [file, ...args] = options.command;
    const child = cp.spawn(file, args, { cwd: options.cwd, env: process.env, stdio: 'inherit', windowsHide: true, shell: options.shell });
    const stop = () => { if (child.exitCode === null && child.signalCode === null)
        child.kill(); };
    process.on('SIGTERM', () => { stop(); process.exit(143); });
    process.on('SIGINT', () => { stop(); process.exit(130); });
    child.on('error', error => { process.stderr.write(`preview command failed to start: ${error.message}\n`); process.exit(1); });
    child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
try {
    const options = parse(process.argv.slice(2));
    if (options.mode === 'static')
        serveStatic(options);
    else
        runScript(options);
}
catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
}
