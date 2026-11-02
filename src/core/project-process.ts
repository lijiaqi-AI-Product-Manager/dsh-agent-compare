import { run, type RunOptions, type RunResult } from './proc.ts'

/** A host-prepared process: argv already carries its enforced file-write policy. */
export interface PreparedProjectProcess {
  readonly argv: readonly string[]
  readonly env: NodeJS.ProcessEnv
  /** Undefined is unknown; trusted fixture runners cannot claim host enforcement. */
  readonly enforcement?: 'full' | 'partial'
}

export interface ProjectProcessRequest {
  readonly argv: readonly string[]
  readonly cwd: string
  /** Deliberate command settings only; never spread the ambient environment here. */
  readonly env?: NodeJS.ProcessEnv
  readonly signal?: AbortSignal
}

export type PrepareProjectProcess = (request: ProjectProcessRequest) => Promise<PreparedProjectProcess>

export async function prepareProjectProcess(request: ProjectProcessRequest, prepare?: PrepareProjectProcess): Promise<PreparedProjectProcess> {
  request.signal?.throwIfAborted()
  if (prepare === undefined) throw new Error('项目命令没有可用的写入边界。请更新宿主并启用其进程沙箱；不会尝试无约束执行。')
  const prepared = await prepare(request)
  request.signal?.throwIfAborted()
  if (!Array.isArray(prepared.argv) || !prepared.argv[0] || prepared.argv.some(a => typeof a !== 'string' || a.includes('\0'))) throw new Error('宿主返回了无效的受限命令')
  if (prepared.env === null || typeof prepared.env !== 'object' || Array.isArray(prepared.env) || Object.entries(prepared.env).some(([key, value]) => key.includes('\0') || key.includes('=') || (value !== undefined && (typeof value !== 'string' || value.includes('\0'))))) throw new Error('宿主没有提供有效的子进程环境；拒绝继承宿主环境执行')
  return prepared
}

/** Every installation and acceptance command must cross the same host boundary. */
export async function runProjectProcess(argv: readonly string[], opts: RunOptions, prepare?: PrepareProjectProcess): Promise<RunResult> {
  const prepared = await prepareProjectProcess({ argv, cwd: opts.cwd, env: opts.env, signal: opts.signal }, prepare)
  return run(prepared.argv, { ...opts, env: prepared.env })
}
