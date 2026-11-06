import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import path from 'node:path'
import { changedPaths, readBlob, treeBlobs } from './git.ts'
import type { Acceptance, CheckCommand, ChecksSpec } from './types.ts'
import { parseAcceptanceConfig, parseBrowserCheck, type AcceptanceConfig } from './acceptance-config.ts'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

export interface ProjectInfo {
  readonly kind: 'vite' | 'unsupported'
  readonly packageManager: PackageManager
  /** Exact manifest declaration, including its optional integrity suffix. */
  readonly packageManagerSpec?: string
  readonly packageManagerVersion?: string
  readonly modernYarn?: boolean
  readonly lockfile?: string
  readonly scripts: Record<string, string>
  readonly reason?: string
  readonly warning?: string
}

interface PackageJson {
  packageManager?: string
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
    if (pkg.packageManager !== undefined && typeof pkg.packageManager !== 'string') throw new Error('packageManager 必须是文本')
    for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      const value = pkg[key]
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(entry => typeof entry !== 'string'))) throw new Error(`${key} 必须是文本键值对象`)
    }
  } catch (error) {
    return { kind: 'unsupported', packageManager: 'npm', scripts: {}, reason: `package.json 无法解析：${(error as Error).message}` }
  }
  const scripts = pkg.scripts ?? {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const locks = LOCKFILES.filter(f => existsSync(path.join(dir, f)))
  const declaration = pkg.packageManager?.match(/^(npm|pnpm|yarn)@(\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?)(?:\+[\da-zA-Z.-]+)?$/)
  if (pkg.packageManager !== undefined && !declaration) return { kind: 'unsupported', packageManager: 'npm', scripts, reason: 'packageManager 需要声明受支持的准确版本，例如 pnpm@12.16.1 或 yarn@4.18.1；目前支持 npm、pnpm 和 Yarn。' }
  if (!declaration && locks.length > 1) return { kind: 'unsupported', packageManager: 'npm', scripts, reason: '存在多个包管理器锁文件，请在 package.json 的 packageManager 中明确选择；不会自动猜测安装方式。' }
  const packageManager: PackageManager = declaration ? declaration[1] as PackageManager : locks[0] === 'pnpm-lock.yaml' ? 'pnpm' : locks[0] === 'yarn.lock' ? 'yarn' : 'npm'
  const expected = packageManager === 'pnpm' ? 'pnpm-lock.yaml' : packageManager === 'yarn' ? 'yarn.lock' : 'package-lock.json'
  const lock = locks.includes(expected as typeof LOCKFILES[number]) ? expected : undefined
  const base = { packageManager, scripts, ...(lock === undefined ? {} : { lockfile: lock }), ...(declaration ? { packageManagerSpec: pkg.packageManager!, packageManagerVersion: declaration[2]! } : {}) }
  if (declaration && locks.length && !lock) return { kind: 'unsupported', ...base, reason: `packageManager 声明使用 ${packageManager}，但缺少对应的 ${expected}；请先统一项目的锁文件。` }
  let modernYarn: boolean | undefined
  if (packageManager === 'yarn') {
    let modernLock = false
    if (lock) {
      const handle = await open(path.join(dir, lock), 'r')
      try { const bytes = Buffer.alloc(8192); const read = await handle.read(bytes, 0, bytes.length, 0); modernLock = /^__metadata:\s*$/m.test(bytes.subarray(0, read.bytesRead).toString('utf8')) } finally { await handle.close() }
    }
    modernYarn = declaration ? Number(declaration[2]!.split('.')[0]) >= 2 : modernLock
    if (lock && declaration && modernLock !== modernYarn) return { kind: 'unsupported', ...base, reason: 'Yarn 锁文件格式与 packageManager 声明不一致，请先使用该版本生成并提交对应锁文件。' }
  }
  if (deps.vite === undefined) return { kind: 'unsupported', ...base, reason: '目前只支持 Vite 项目（依赖里没有 vite）' }
  let warning: string | undefined
  if (modernYarn) {
    const config = await readFile(path.join(dir, '.yarnrc.yml'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
    if (!/^nodeLinker:\s*(["']?)node-modules\1\s*(?:#.*)?$/m.test(config)) warning = 'Yarn 现代版的完整验收覆盖 node-modules 模式；PnP 与 TypeScript 7 组合仍有限制。请先确认项目现有检查能够运行，失败检查不会被跳过。'
  }
  return { kind: 'vite', ...base, ...(modernYarn === undefined ? {} : { modernYarn }), ...(warning ? { warning } : {}) }
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
      return { argv: ['pnpm', 'install', ...(frozen ? ['--frozen-lockfile'] : []), '--prefer-offline'], frozen }
    case 'yarn':
      return { argv: ['yarn', 'install', ...(info.modernYarn ? [frozen ? '--immutable' : '--no-immutable'] : frozen ? ['--frozen-lockfile'] : [])], frozen }
    case 'npm':
      return frozen
        ? { argv: ['npm', 'ci', '--prefer-offline', '--no-audit', '--no-fund'], frozen }
        : { argv: ['npm', 'install', '--prefer-offline', '--no-audit', '--no-fund'], frozen }
  }
}

export function scriptArgv(info: ProjectInfo, script: string): string[] {
  return info.packageManager === 'npm' ? ['npm', 'run', script, '--silent'] : [info.packageManager, 'run', script]
}

/** An exact declared manager must be ready before either model receives work. */
export function managerVersionIssue(info: ProjectInfo, observed: string | undefined, platform = process.platform): string | undefined {
  const prefix = `项目包管理器未就绪：${info.packageManager}`
  if (!observed || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(observed)) return `${prefix} 未报告可确认的版本；未请求模型。`
  if (info.packageManagerVersion && observed.split('+')[0] !== info.packageManagerVersion) return `${prefix} 需要 ${info.packageManagerVersion}，当前为 ${observed}；未请求模型。`
  if (info.packageManager === 'yarn' && info.modernYarn !== (Number(observed.split('.')[0]) >= 2)) return `${prefix} 版本与锁文件格式不一致；未请求模型。`
  if (platform === 'win32' && info.packageManager === 'pnpm' && Number(observed.split('.')[0]) >= 12) return `${prefix} ${observed} 的 Windows 存储锁需要写入候选目录之外，当前宿主沙箱不支持该路径；不会放宽写入边界，也不会自动更换项目版本；未请求模型。`
  return undefined
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
    : { name: 'build', argv: info.modernYarn ? ['yarn', 'exec', 'vite', 'build'] : ['node', VITE_BIN, 'build'], timeoutMs: 300_000 })
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
  /^pnpm-workspace\.yaml$/,
  /^\.yarn\/(releases|plugins|patches)\//,
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
export async function buildAcceptance(repo: string, tree: string, info: ProjectInfo, override?: ChecksSpec, windowsProcessCompat?: 'auto' | 'off'): Promise<Acceptance> {
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
  const runtime = { node: process.version, packageManager: info.packageManagerSpec ?? info.packageManager, platform: `${process.platform}-${process.arch}`, ...(info.modernYarn ? { yarnModern: true } : {}), ...(windowsProcessCompat === undefined ? {} : { windowsProcessCompat }) }
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
