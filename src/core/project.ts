import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CheckCommand, ChecksSpec } from './types.ts'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

export interface ProjectInfo {
  readonly kind: 'vite' | 'unsupported'
  readonly packageManager: PackageManager
  readonly lockfile?: string
  readonly scripts: Record<string, string>
  readonly reason?: string
}

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export async function inspectProject(dir: string): Promise<ProjectInfo> {
  const pkgPath = path.join(dir, 'package.json')
  if (!existsSync(pkgPath)) return { kind: 'unsupported', packageManager: 'npm', scripts: {}, reason: 'no package.json at the repository root' }
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as PackageJson
  const scripts = pkg.scripts ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const lock = (['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'] as const).find((f) => existsSync(path.join(dir, f)))
  const packageManager: PackageManager = lock === 'pnpm-lock.yaml' ? 'pnpm' : lock === 'yarn.lock' ? 'yarn' : 'npm'
  const base = { packageManager, scripts, ...(lock === undefined ? {} : { lockfile: lock }) }
  if (deps.vite === undefined) return { kind: 'unsupported', ...base, reason: 'v0.1 supports Vite projects only (no "vite" dependency found)' }
  return { kind: 'vite', ...base }
}

/** Install argv: frozen when a lockfile exists, so candidates cannot silently resolve different trees. */
export function installArgv(info: ProjectInfo, frozen: boolean): string[] {
  switch (info.packageManager) {
    case 'pnpm':
      return ['pnpm', 'install', frozen ? '--frozen-lockfile' : '--no-frozen-lockfile', '--prefer-offline']
    case 'yarn':
      return ['yarn', 'install', ...(frozen ? ['--frozen-lockfile'] : [])]
    case 'npm':
      return info.lockfile !== undefined && frozen
        ? ['npm', 'ci', '--prefer-offline', '--no-audit', '--no-fund']
        : ['npm', 'install', '--prefer-offline', '--no-audit', '--no-fund']
  }
}

export function scriptArgv(info: ProjectInfo, script: string): string[] {
  return info.packageManager === 'npm' ? ['npm', 'run', script, '--silent'] : [info.packageManager, 'run', script]
}

const PLACEHOLDER_TEST = /no test specified/i

/**
 * The shared acceptance every candidate runs, derived once from the BASELINE
 * (not from a candidate), so an agent cannot weaken its own bar.
 */
export function defaultChecks(info: ProjectInfo): ChecksSpec {
  const commands: CheckCommand[] = []
  for (const name of ['typecheck', 'lint', 'build', 'test']) {
    const body = info.scripts[name]
    if (body === undefined || PLACEHOLDER_TEST.test(body)) continue
    commands.push({ name, argv: scriptArgv(info, name), timeoutMs: name === 'test' ? 300_000 : 180_000 })
  }
  return { commands, browser: { path: '/', failOnConsoleError: true } }
}
