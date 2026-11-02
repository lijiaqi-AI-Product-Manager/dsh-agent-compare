import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { changedPaths, readBlob, treeBlobs } from './git.ts'
import type { Acceptance, CheckCommand, ChecksSpec } from './types.ts'
import { parseAcceptanceConfig, parseBrowserCheck, type AcceptanceConfig } from './acceptance-config.ts'

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
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export const LOCKFILES = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'] as const

export async function inspectProject(dir: string): Promise<ProjectInfo> {
  const pkgPath = path.join(dir, 'package.json')
  if (!existsSync(pkgPath)) return { kind: 'unsupported', packageManager: 'npm', scripts: {}, reason: '仓库根目录没有 package.json' }
  let pkg: PackageJson
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as PackageJson
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('根节点必须是对象')
    for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      const value = pkg[key]
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(entry => typeof entry !== 'string'))) throw new Error(`${key} 必须是文本键值对象`)
    }
  } catch (error) {
    return { kind: 'unsupported', packageManager: 'npm', scripts: {}, reason: `package.json 无法解析：${(error as Error).message}` }
  }
  const scripts = pkg.scripts ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const lock = LOCKFILES.find((f) => existsSync(path.join(dir, f)))
  const packageManager: PackageManager = lock === 'pnpm-lock.yaml' ? 'pnpm' : lock === 'yarn.lock' ? 'yarn' : 'npm'
  const base = { packageManager, scripts, ...(lock === undefined ? {} : { lockfile: lock }) }
  if (deps.vite === undefined) return { kind: 'unsupported', ...base, reason: '目前只支持 Vite 项目（依赖里没有 vite）' }
  return { kind: 'vite', ...base }
}

/**
 * Install argv. With a lockfile the install is always frozen: a candidate that
 * changed dependencies without updating the lockfile fails here instead of
 * being resolved to a different tree than the one it will be adopted with.
 */
export function installArgv(info: ProjectInfo): { argv: string[]; frozen: boolean } {
  const frozen = info.lockfile !== undefined
  switch (info.packageManager) {
    case 'pnpm':
      return { argv: ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline'], frozen }
    case 'yarn':
      return { argv: ['yarn', 'install', '--frozen-lockfile'], frozen }
    case 'npm':
      return frozen
        ? { argv: ['npm', 'ci', '--prefer-offline', '--no-audit', '--no-fund'], frozen }
        : { argv: ['npm', 'install', '--prefer-offline', '--no-audit', '--no-fund'], frozen }
  }
}

export function scriptArgv(info: ProjectInfo, script: string): string[] {
  return info.packageManager === 'npm' ? ['npm', 'run', script, '--silent'] : [info.packageManager, 'run', script]
}

const VITE_BIN = path.join('node_modules', 'vite', 'bin', 'vite.js')
const PLACEHOLDER_TEST = /no test specified/i

/**
 * The shared checks, derived once from the BASELINE (never from a candidate).
 * The build always runs, last, because the preview serves its output.
 */
export function defaultChecks(info: ProjectInfo): ChecksSpec {
  const commands: CheckCommand[] = []
  for (const name of ['typecheck', 'lint', 'test']) {
    const body = info.scripts[name]
    if (body === undefined || PLACEHOLDER_TEST.test(body)) continue
    commands.push({ name, argv: scriptArgv(info, name), timeoutMs: name === 'test' ? 300_000 : 180_000 })
  }
  commands.push(info.scripts.build !== undefined
    ? { name: 'build', argv: scriptArgv(info, 'build'), timeoutMs: 300_000 }
    : { name: 'build', argv: ['node', VITE_BIN, 'build'], timeoutMs: 300_000 })
  return { commands, browser: { path: '/', failOnConsoleError: true } }
}

/** The optional repository file that defines the acceptance (read from the baseline tree). */
export const ACCEPTANCE_FILE = '.agent-compare.json'

/**
 * Files whose content changes what a check means. A candidate may add new
 * tests; it may not edit or delete these baseline files and still count as
 * passing the shared acceptance.
 */
const CONFIG_PATTERNS: readonly RegExp[] = [
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(vite|vitest|playwright|jest|svelte|astro|rollup)\.config\.[cm]?[jt]sx?$/,
  /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.[a-z]+)?|\.prettierrc(\.[a-z]+)?|biome\.json)$/,
  /^\.(npmrc|nvmrc|node-version|yarnrc(\.yml)?)$/,
  /^\.agent-compare\.json$/,
  /(^|\/)\.(gitignore|gitattributes|gitmodules)$/,
  /(^|\/)\.env(\.[^/]*)?$/,
  /^[^/]+\.[cm]?[jt]s$/,
  /(^|\/)(scripts|tools|config)\//,
  /(^|\/)(check|verify|validate|test|lint|setup)([.-][^/]*)?\.[cm]?[jt]s$/,
]
const TEST_PATTERNS: readonly RegExp[] = [/\.(test|spec)\.[cm]?[jt]sx?$/, /(^|\/)(__tests__|tests?|e2e)\//]

const isTest = (p: string): boolean => TEST_PATTERNS.some((re) => re.test(p))
const isConfig = (p: string): boolean => !isTest(p) && CONFIG_PATTERNS.some((re) => re.test(p))
export const isBound = (p: string): boolean => isConfig(p) || isTest(p)

/** Build the acceptance for a baseline tree. `override` (tests, API) replaces the derived checks. */
export async function buildAcceptance(repo: string, tree: string, info: ProjectInfo, override?: ChecksSpec): Promise<Acceptance> {
  let checks = override ?? defaultChecks(info)
  if (checks.browser !== undefined) checks = { ...checks, browser: parseBrowserCheck(checks.browser) }
  let source: Acceptance['source'] = 'defaults'
  let protectedFiles: readonly string[] = []
  const fileText = override === undefined ? await readBlob(repo, tree, ACCEPTANCE_FILE) : undefined
  if (fileText !== undefined) {
    let parsed: AcceptanceConfig
    try {
      parsed = parseAcceptanceConfig(JSON.parse(fileText), info.scripts)
    } catch (error) {
      throw new Error(`${ACCEPTANCE_FILE} 无法解析：${(error as Error).message}`)
    }
    const extra = (parsed.scripts ?? []).filter((s) => !checks.commands.some((c) => c.name === s))
    const commands = [...checks.commands.filter((c) => c.name !== 'build'), ...extra.map((s) => ({ name: s, argv: scriptArgv(info, s), timeoutMs: 300_000 })), ...checks.commands.filter((c) => c.name === 'build')]
    checks = { commands, browser: { ...checks.browser, ...parsed.browser } }
    source = 'repository'
    protectedFiles = parsed.protectedFiles ?? []
  }
  // Lifecycle and nested script calls can affect verification even when the
  // directly invoked script body is unchanged.
  const scripts = { ...info.scripts }
  const bound = await treeBlobs(repo, tree, p => isBound(p) || protectedFiles.includes(p))
  for (const file of protectedFiles) if (!Object.hasOwn(bound, file)) throw new Error(`${ACCEPTANCE_FILE} protectedFiles：基线中不存在 ${file}`)
  const runtime = { node: process.version, packageManager: info.packageManager, platform: `${process.platform}-${process.arch}` }
  const body = { checks, scripts, bound, runtime, ...(info.lockfile === undefined ? {} : { lockfile: info.lockfile }) }
  return {
    ...body,
    source,
    sha256: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
  }
}

/**
 * What a candidate changed that the acceptance is bound to, and whether it
 * changed dependencies. Returned paths read like `tsconfig.json` or
 * `package.json scripts.test`.
 */
export async function acceptanceChanges(repo: string, acceptance: Acceptance, baseTree: string, candTree: string): Promise<{ touched: string[]; dependencyChange: boolean }> {
  const changed = await changedPaths(repo, baseTree, candTree)
  const touched = changed.filter((p) => Object.hasOwn(acceptance.bound, p) || isConfig(p))
  let dependencyChange = changed.some((p) => (LOCKFILES as readonly string[]).includes(p))
  if (changed.includes('package.json')) {
    const before = parsePkg(await readBlob(repo, baseTree, 'package.json'))
    const after = parsePkg(await readBlob(repo, candTree, 'package.json'))
    for (const name of new Set([...Object.keys(before.scripts ?? {}), ...Object.keys(after.scripts ?? {})])) if (after.scripts?.[name] !== before.scripts?.[name]) touched.push(`package.json scripts.${name}`)
    for (const key of ['type', 'packageManager', 'engines', 'imports', 'exports', 'eslintConfig', 'jest', 'browserslist'] as const) {
      if (JSON.stringify((before as Record<string, unknown>)[key]) !== JSON.stringify((after as Record<string, unknown>)[key])) touched.push(`package.json ${key}`)
    }
    for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      if (JSON.stringify(before[k] ?? {}) !== JSON.stringify(after[k] ?? {})) dependencyChange = true
    }
  }
  return { touched, dependencyChange }
}

function parsePkg(text: string | undefined): PackageJson {
  try {
    return text === undefined ? {} : (JSON.parse(text) as PackageJson)
  } catch {
    return {}
  }
}
