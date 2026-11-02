import path from 'node:path'
import { realpath } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { which } from '../core/proc.ts'
import type { PrepareProjectProcess, ProjectProcessRequest } from '../core/project-process.ts'

/** Matches the current host's public process-confinement seam. */
export interface ProjectSandbox {
  confine(argv: readonly string[], policy: { mode: 'workspace-write'; workspaceRoot: string }, signal?: AbortSignal): Promise<{
    argv: string[]
    enforcement: 'full' | 'partial'
  }>
}

/** Resolve shell shims before confinement, but interpret them only inside it. */
export function projectCommandArgv(argv: readonly string[], cwd: string, platform = process.platform): string[] {
  const [command, ...args] = argv
  if (!command || argv.some(a => typeof a !== 'string' || a.includes('\0'))) throw new Error('项目命令参数无效')
  const file = command === 'node' ? process.execPath
    : path.isAbsolute(command) ? command
    : /[\\/]/.test(command) ? path.resolve(cwd, command)
    : which(command)
  if (!file) throw new Error(`没有找到项目命令 ${command}`)
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js'
    return [process.execPath, fileURLToPath(new URL(`../core/project-command-worker.${extension}`, import.meta.url)), file, ...args]
  }
  return [file, ...args]
}

/**
 * The canonical scrub is supplied by the host; no credential-bearing ambient
 * environment is copied back over it. Each copy owns its package caches.
 */
export function createProjectProcess(
  sandbox: () => ProjectSandbox | undefined,
  baseEnvironment: () => Promise<NodeJS.ProcessEnv> = async () => {
    const service = await import('@deepseek-ai/dsh-subprocess' as string) as { scrubbedParentEnv?: () => NodeJS.ProcessEnv }
    if (typeof service.scrubbedParentEnv !== 'function') throw new Error('宿主缺少规范的子进程环境接口，请更新宿主')
    return service.scrubbedParentEnv()
  },
): PrepareProjectProcess {
  return async (request: ProjectProcessRequest) => {
    request.signal?.throwIfAborted()
    const provider = sandbox()
    if (typeof provider?.confine !== 'function') throw new Error('宿主没有可用的进程沙箱，请更新并启用进程沙箱；不会尝试无约束执行')
    const root = await realpath(request.cwd)
    const argv = projectCommandArgv(request.argv, root)
    const confined = await provider.confine(argv, { mode: 'workspace-write', workspaceRoot: root }, request.signal)
    if (confined.enforcement !== 'full' && confined.enforcement !== 'partial') throw new Error('宿主没有报告有效的文件写入约束，本轮项目命令已停止')
    const env = { ...await baseEnvironment() }
    const cache = path.join(root, '.vite', 'agent-compare-cache')
    const explicit: NodeJS.ProcessEnv = {
      ...request.env,
      npm_config_cache: path.join(cache, 'npm'),
      COREPACK_HOME: path.join(cache, 'corepack'),
      YARN_CACHE_FOLDER: path.join(cache, 'yarn'),
      YARN_GLOBAL_FOLDER: path.join(cache, 'yarn-global'),
    }
    // npm rejects unknown environment configuration. Only pnpm receives its
    // store setting; each manager still keeps its own mutable cache.
    if (/^(pnpm|pnpm\.cmd|pnpm\.exe)$/i.test(path.basename(request.argv[0] ?? ''))) explicit.npm_config_store_dir = path.join(cache, 'pnpm')
    if (process.platform === 'win32') {
      const extension = import.meta.url.endsWith('.ts') ? 'cts' : 'cjs'
      const preload = fileURLToPath(new URL(`../core/windows-vite-probe.${extension}`, import.meta.url)).replace(/\\/g, '/')
      explicit.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require "${preload}"`.trim()
    }
    // Windows environment names are case-insensitive. Remove an older spelling
    // before setting a deliberate override instead of passing duplicate keys.
    for (const [key, value] of Object.entries(explicit)) {
      for (const inherited of Object.keys(env)) if (inherited.toUpperCase() === key.toUpperCase()) delete env[inherited]
      if (value !== undefined) env[key] = value
    }
    return { argv: confined.argv, env, enforcement: confined.enforcement }
  }
}
