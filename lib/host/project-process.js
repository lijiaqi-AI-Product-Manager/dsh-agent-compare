var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { which } from '../core/proc.js';
/** Resolve shell shims before confinement, but interpret them only inside it. */
export function projectCommandArgv(argv, cwd, platform = process.platform, resolution) {
    const [command, ...args] = argv;
    if (!command || argv.some(a => typeof a !== 'string' || a.includes('\0')))
        throw new Error('项目命令参数无效');
    const file = command === 'node' ? process.execPath
        : path.isAbsolute(command) ? command
            : /[\\/]/.test(command) ? path.resolve(cwd, command)
                : which(command, resolution?.path);
    if (!file && command === 'pnpm' && resolution?.pnpm) {
        const managed = resolution.pnpm;
        if (!path.isAbsolute(managed.command) || !Array.isArray(managed.args) || managed.args.some(value => typeof value !== 'string' || value.includes('\0')))
            throw new Error('宿主内置 pnpm 的入口格式不受支持');
        return projectCommandArgv([managed.command, ...managed.args, ...args], cwd, platform);
    }
    if (!file)
        throw new Error(`没有找到项目命令 ${command}`);
    if (platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
        const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
        return [process.execPath, fileURLToPath(new URL(`../core/project-command-worker.${extension}`, import.meta.url)), file, ...args];
    }
    return [file, ...args];
}
/**
 * The canonical scrub is supplied by the host; no credential-bearing ambient
 * environment is copied back over it. Each copy owns its package caches.
 */
export function createProjectProcess(sandbox, baseEnvironment = async () => {
    const service = await import(__rewriteRelativeImportExtension('@deepseek-ai/dsh-subprocess'));
    if (typeof service.scrubbedParentEnv !== 'function')
        throw new Error('宿主缺少规范的子进程环境接口，请更新宿主');
    return service.scrubbedParentEnv();
}, windowsProcessModule, bundledPnpm = () => undefined, windowsProcessCompat = 'auto') {
    return async (request) => {
        request.signal?.throwIfAborted();
        const provider = sandbox();
        if (typeof provider?.confine !== 'function')
            throw new Error('宿主没有可用的进程沙箱，请更新并启用进程沙箱；不会尝试无约束执行');
        const root = await realpath(request.cwd);
        const bundled = bundledPnpm();
        let argv = projectCommandArgv(request.argv, root, process.platform, { pnpm: bundled });
        const pnpm = /^(pnpm|pnpm\.cmd|pnpm\.exe)$/i.test(path.basename(request.argv[0] ?? ''));
        if (pnpm && process.platform !== 'win32') {
            const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
            argv = [process.execPath, fileURLToPath(new URL(`../core/project-command-worker.${extension}`, import.meta.url)), ...argv];
        }
        const confined = await provider.confine(argv, { mode: 'workspace-write', workspaceRoot: root }, request.signal);
        if (confined.enforcement !== 'full' && confined.enforcement !== 'partial')
            throw new Error('宿主没有报告有效的文件写入约束，本轮项目命令已停止');
        const env = { ...await baseEnvironment() };
        const mode = request.windowsProcessCompat ?? windowsProcessCompat;
        if (mode !== 'auto' && mode !== 'off')
            throw new Error('Windows 进程兼容设置无效');
        // These activation switches belong to this invocation, not the ambient host.
        for (const key of Object.keys(env))
            if (['AGENT_COMPARE_WINDOWS_PIPE_COMPAT', 'AGENT_COMPARE_WIN32_PROCESS_MODULE'].includes(key.toUpperCase()))
                delete env[key];
        const cache = path.join(root, '.vite', 'agent-compare-cache');
        const explicit = {
            ...request.env,
            npm_config_cache: path.join(cache, 'npm'),
            COREPACK_HOME: path.join(cache, 'corepack'),
            YARN_CACHE_FOLDER: path.join(cache, 'yarn'),
            YARN_GLOBAL_FOLDER: path.join(cache, 'yarn-global'),
            YARN_INSTALL_STATE_PATH: path.join(cache, 'yarn-install-state.gz'),
            YARN_PNP_UNPLUGGED_FOLDER: path.join(cache, 'yarn-unplugged'),
        };
        for (const key of Object.keys(explicit))
            if (['AGENT_COMPARE_WINDOWS_PIPE_COMPAT', 'AGENT_COMPARE_WIN32_PROCESS_MODULE'].includes(key.toUpperCase()))
                delete explicit[key];
        // npm rejects unknown environment configuration. Only pnpm receives its
        // store setting; each manager still keeps its own mutable cache.
        if (pnpm) {
            explicit.npm_config_store_dir = path.join(cache, 'pnpm');
            explicit.PNPM_HOME = path.join(cache, 'pnpm-home');
            if (process.platform !== 'win32') {
                explicit.XDG_RUNTIME_DIR = path.join(cache, 'pnpm-runtime');
                explicit.AGENT_COMPARE_PACKAGE_RUNTIME = '1';
            }
            // Preserve only this runtime switch from a host-owned invocation. Its
            // package-operation environment can contain unrelated credentials.
            if (!which('pnpm') && bundled?.env?.ELECTRON_RUN_AS_NODE === '1')
                explicit.ELECTRON_RUN_AS_NODE = '1';
        }
        if (process.platform === 'win32' && mode === 'auto') {
            // npm's foreground mode reuses inherited stdio for lifecycle scripts.
            // Confined Windows grandchildren cannot create the background pipes.
            // This changes output handling, not which scripts the project permits.
            if (/^npm(?:\.cmd|\.exe)?$/i.test(path.basename(request.argv[0] ?? '')))
                explicit.npm_config_foreground_scripts = 'true';
            const extension = import.meta.url.endsWith('.ts') ? 'cts' : 'cjs';
            const preload = fileURLToPath(new URL(`../core/windows-vite-probe.${extension}`, import.meta.url)).replace(/\\/g, '/');
            const pipes = fileURLToPath(new URL(`../core/windows-project-pipes.${extension}`, import.meta.url)).replace(/\\/g, '/');
            explicit.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require "${preload}" --require "${pipes}"`.trim();
            explicit.AGENT_COMPARE_WINDOWS_PIPE_COMPAT = '1';
            if (windowsProcessModule)
                explicit.AGENT_COMPARE_WIN32_PROCESS_MODULE = windowsProcessModule;
            else {
                try {
                    explicit.AGENT_COMPARE_WIN32_PROCESS_MODULE = createRequire(import.meta.url).resolve('@deepseek-ai/dsh-win32-process');
                }
                catch { /* The compatibility layer reports a missing native host API only when needed. */ }
            }
        }
        // Windows environment names are case-insensitive. Remove an older spelling
        // before setting a deliberate override instead of passing duplicate keys.
        for (const [key, value] of Object.entries(explicit)) {
            for (const inherited of Object.keys(env))
                if (inherited.toUpperCase() === key.toUpperCase())
                    delete env[inherited];
            if (value !== undefined)
                env[key] = value;
        }
        return { argv: confined.argv, env, enforcement: confined.enforcement, windowsProcessCompat: { mode: process.platform === 'win32' ? mode : 'not-required', observedHooks: [] } };
    };
}
