/**
 * Windows command shims need a command interpreter. Launch it only AFTER this
 * trusted Node entry has entered the host's confinement, so the wrapped argv
 * is an executable invocation rather than an ambiguous shell string.
 */
import { spawn } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { spawnSpec } from './proc.ts'

// This entry executes after confinement. Create pnpm's Unix lock directory
// here, never from the unrestricted host against a candidate-controlled path.
if (process.env.AGENT_COMPARE_PACKAGE_RUNTIME === '1') {
  const runtime = process.env.XDG_RUNTIME_DIR
  if (!runtime || !path.isAbsolute(runtime)) throw new Error('项目运行目录无效')
  const root = realpathSync(process.cwd())
  const inside = (value: string): boolean => { const relative = path.relative(root, value); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) }
  if (!inside(runtime)) throw new Error('项目运行目录离开了候选副本')
  let parent = runtime
  while (!existsSync(parent)) parent = path.dirname(parent)
  if (!inside(realpathSync(parent)) || lstatSync(parent).isSymbolicLink()) throw new Error('项目运行目录的父路径不可信')
  mkdirSync(runtime, { recursive: true, mode: 0o700 })
  if (lstatSync(runtime).isSymbolicLink() || !inside(realpathSync(runtime))) throw new Error('项目运行目录离开了候选副本')
}

const spec = spawnSpec(process.argv.slice(2))
const child = spawn(spec.file, spec.args, {
  cwd: process.cwd(),
  env: process.env,
  shell: spec.shell,
  windowsHide: true,
  stdio: 'inherit',
})
child.once('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.once('close', (code) => { process.exitCode = code ?? 1 })
