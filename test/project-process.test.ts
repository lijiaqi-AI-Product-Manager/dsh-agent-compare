import { describe, expect, it, vi } from 'vitest'
import { access, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareProjectProcess, runProjectProcess } from '../src/core/project-process.ts'
import { createProjectProcess, projectCommandArgv } from '../src/host/project-process.ts'
import { runCommandChecks } from '../src/core/checks.ts'
import { Comparer } from '../src/core/orchestrator.ts'
import { diagnosticText, DiagnosticLog, run } from '../src/core/proc.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'
import { RunStore } from '../src/core/run-store.ts'
import { git } from '../src/core/git.ts'

describe('project command boundary', () => {
  it('prepares a private manager runtime without accepting an outside directory', async () => {
    // Native macOS temporary roots can themselves be symlink aliases. Match
    // the canonical root supplied by createProjectProcess before confinement.
    const root = await realpath(await tmp('ac-manager-runtime')), runtime = path.join(root, '.cache', 'runtime')
    const worker = fileURLToPath(new URL('../lib/core/project-command-worker.js', import.meta.url))
    const invoke = (directory: string) => run([process.execPath, worker, process.execPath, '-e', "process.stdout.write(require('node:fs').existsSync(process.env.XDG_RUNTIME_DIR)?'ready':'missing')"], { cwd: root, env: { ...process.env, AGENT_COMPARE_PACKAGE_RUNTIME: '1', XDG_RUNTIME_DIR: directory }, timeoutMs: 30_000 })
    const result = await invoke(runtime)
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout).toBe('ready')
    expect(await invoke(path.join(root, '..', 'must-not-create-' + path.basename(root)))).toMatchObject({ code: 1, stderr: expect.stringContaining('离开了候选副本') })
  })
  it('rejects a private manager runtime whose existing parent links outside the copy', async () => {
    const root = await realpath(await tmp('ac-manager-link')), outside = await realpath(await tmp('ac-manager-outside'))
    await symlink(outside, path.join(root, '.cache'), process.platform === 'win32' ? 'junction' : 'dir')
    const worker = fileURLToPath(new URL('../lib/core/project-command-worker.js', import.meta.url))
    const result = await run([process.execPath, worker, process.execPath, '-e', "process.stdout.write('must-not-run')"], { cwd: root, env: { ...process.env, AGENT_COMPARE_PACKAGE_RUNTIME: '1', XDG_RUNTIME_DIR: path.join(root, '.cache', 'runtime') }, timeoutMs: 30_000 })
    expect(result).toMatchObject({ code: 1, stdout: '', stderr: expect.stringContaining('父路径不可信') })
    await expect(access(path.join(outside, 'runtime'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('starts neither candidate when the declared common manager version is unavailable', async () => {
    const repo = await fixtureRepo()
    const manifest = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'))
    await writeFile(path.join(repo, 'package.json'), JSON.stringify({ ...manifest, packageManager: 'npm@0.0.0' }))
    await git(repo, ['add', 'package.json'])
    await git(repo, ['commit', '-qm', 'Pin an unavailable fixture manager'])
    const runner = { isolation: 'own-root' as const, run: vi.fn() }
    const comparer = new Comparer({ store: new RunStore(await tmp('ac-manager-readiness')), runner, version: 'test', prepareProjectProcess: prepareFixtureProcess })
    const started = await comparer.start({ repo, task: 'Keep the existing page' })
    try {
      const result = await comparer.wait(started.runId)
      expect(result.candidates.every(candidate => candidate.error?.stage === 'preparing' && candidate.error.message.includes('未请求模型'))).toBe(true)
      expect(runner.run).not.toHaveBeenCalled()
      expect(JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8')).packageManager).toBe('npm@0.0.0')
    } finally { await comparer.cleanup(started.runId); await comparer.dispose() }
  })
  it('uses the host pnpm entry when PATH has none and keeps argv boundaries', () => {
    const cli = path.join(process.cwd(), 'host space', 'pnpm.cjs')
    expect(projectCommandArgv(['pnpm', 'run', 'build'], process.cwd(), process.platform, { path: '', pnpm: { command: process.execPath, args: [cli] } })).toEqual([process.execPath, cli, 'run', 'build'])
    expect(() => projectCommandArgv(['yarn'], process.cwd(), process.platform, { path: '', pnpm: { command: process.execPath, args: [cli] } })).toThrow(/没有找到/)
    expect(() => projectCommandArgv(['pnpm'], process.cwd(), process.platform, { path: '', pnpm: { command: 'pnpm', args: [] } })).toThrow(/入口格式/)
  })

  it('uses inherited npm lifecycle output on Windows without granting script permission', async () => {
    const root = await tmp('ac-lifecycle-boundary')
    const prepare = createProjectProcess(() => ({ confine: async argv => ({ argv: [...argv], enforcement: 'partial' }) }), async () => ({ NPM_CONFIG_FOREGROUND_SCRIPTS: 'false' }))
    const result = await prepare({ argv: [path.join(root, 'npm.cmd'), 'ci'], cwd: root, env: { npm_config_ignore_scripts: 'true' } })
    expect(result.env.npm_config_ignore_scripts).toBe('true')
    expect(result.env.npm_config_allow_scripts).toBeUndefined()
    if (process.platform === 'win32') {
      expect(result.env.npm_config_foreground_scripts).toBe('true')
      expect(Object.keys(result.env).filter(key => key.toLowerCase() === 'npm_config_foreground_scripts')).toEqual(['npm_config_foreground_scripts'])
    } else expect(result.env.NPM_CONFIG_FOREGROUND_SCRIPTS).toBe('false')
    const other = await createProjectProcess(() => ({ confine: async argv => ({ argv: [...argv], enforcement: 'partial' }) }), async () => ({}))({ argv: ['node', '--version'], cwd: root })
    expect(other.env.npm_config_foreground_scripts).toBeUndefined()
  })

  it('removes compatibility activation in off mode while retaining confinement and deliberate script settings', async () => {
    const root = await tmp('ac-compat-off'), confine = vi.fn(async (argv: readonly string[]) => ({ argv: [...argv], enforcement: 'partial' as const }))
    const prepare = createProjectProcess(() => ({ confine }), async () => ({ NODE_OPTIONS: '--no-deprecation', agent_compare_windows_pipe_compat: '1', AGENT_COMPARE_WIN32_PROCESS_MODULE: 'inherited-module' }))
    const result = await prepare({ argv: ['node', '--version'], cwd: root, windowsProcessCompat: 'off', env: { AGENT_COMPARE_WINDOWS_PIPE_COMPAT: '1', npm_config_ignore_scripts: 'true' } })
    expect(confine).toHaveBeenCalledOnce()
    expect(result.enforcement).toBe('partial')
    expect(result.env.NODE_OPTIONS).toBe('--no-deprecation')
    expect(Object.keys(result.env).some(key => /AGENT_COMPARE_(WINDOWS_PIPE_COMPAT|WIN32_PROCESS_MODULE)/i.test(key))).toBe(false)
    expect(result.env.npm_config_ignore_scripts).toBe('true')
    expect(result.windowsProcessCompat).toEqual({ mode: process.platform === 'win32' ? 'off' : 'not-required', observedHooks: [] })
    await expect(prepare({ argv: ['node'], cwd: root, windowsProcessCompat: 'invalid' as any })).rejects.toThrow(/兼容设置/)
  })

  it('retains a failure heading and its final detail within a bounded diagnostic', () => {
    const text = 'ROOT FAILURE\n' + 'stack detail\n'.repeat(500) + 'FINAL DETAIL'
    expect(diagnosticText(text, 200)).toHaveLength(200)
    expect(diagnosticText(text, 200)).toMatch(/^ROOT FAILURE/)
    expect(diagnosticText(text, 200)).toMatch(/FINAL DETAIL$/)
    const log = new DiagnosticLog(200)
    for (const line of text.match(/.{1,83}/gs) ?? []) log.push(line)
    expect(log.toString()).toHaveLength(200)
    expect(log.toString()).toMatch(/^ROOT FAILURE/)
    expect(log.toString()).toMatch(/FINAL DETAIL$/)
  })
  it('refuses an absent boundary before creating or executing a comparison', async () => {
    const runner = { isolation: 'own-root' as const, run: vi.fn() }
    const comparer = new Comparer({ version: 'test', runner })
    await expect(comparer.start({ repo: 'not-needed', task: 'test' })).rejects.toThrow(/写入边界/)
    expect(runner.run).not.toHaveBeenCalled()
    await expect(runProjectProcess(['node', '-e', 'process.exit(0)'], { cwd: process.cwd() })).rejects.toThrow(/不会尝试无约束/)
    await expect(runProjectProcess(['node'], { cwd: process.cwd() }, async () => ({ argv: [process.execPath], env: undefined as any }))).rejects.toThrow(/拒绝继承宿主环境/)
  })

  it('preserves cancellation before preparation and after a pending confinement call', async () => {
    const controller = new AbortController()
    const prepare = vi.fn()
    controller.abort()
    await expect(prepareProjectProcess({ argv: ['node'], cwd: process.cwd(), signal: controller.signal }, prepare)).rejects.toThrow()
    expect(prepare).not.toHaveBeenCalled()
    const pending = new AbortController()
    await expect(prepareProjectProcess({ argv: ['node'], cwd: process.cwd(), signal: pending.signal }, async () => {
      pending.abort()
      return { argv: [process.execPath], env: {} }
    })).rejects.toThrow()
  })

  it('keeps command shims behind a trusted executable entry without joining their arguments', () => {
    const shim = path.join(process.cwd(), 'a space', 'npm.cmd')
    const args = ['run', 'build', '--', 'a b', '&echo', '%PATH%', 'quote"value']
    const argv = projectCommandArgv([shim, ...args], process.cwd(), 'win32')
    expect(argv[0]).toBe(process.execPath)
    expect(argv[1]).toMatch(/project-command-worker\.(js|ts)$/)
    expect(argv.slice(2)).toEqual([shim, ...args])
    expect(projectCommandArgv(['node', '-e', '1'], process.cwd())[0]).toBe(process.execPath)
    expect(() => projectCommandArgv([], process.cwd())).toThrow(/参数无效/)
  })

  it('uses the canonical copy root and records partial enforcement without upgrading it', async () => {
    const root = await tmp('ac-boundary')
    const confine = vi.fn(async (argv: readonly string[]) => ({ argv: [...argv], enforcement: 'partial' as const }))
    const base = { PATH: process.env.PATH, npm_CONFIG_CACHE: 'old-cache', KEEP: 'yes', DROP: 'remove' }
    const prepare = createProjectProcess(() => ({ confine }), async () => base)
    const result = await prepare({ argv: ['node', '--version'], cwd: root, env: { CI: '1', DROP: undefined } })
    expect(confine).toHaveBeenCalledWith([process.execPath, '--version'], { mode: 'workspace-write', workspaceRoot: await realpath(root) }, undefined)
    expect(result.enforcement).toBe('partial')
    expect(result.env.KEEP).toBe('yes')
    expect(result.env.CI).toBe('1')
    expect(result.env.DROP).toBeUndefined()
    expect(Object.keys(result.env).filter(k => k.toUpperCase() === 'NPM_CONFIG_CACHE')).toEqual(['npm_config_cache'])
    expect(result.env.npm_config_store_dir).toBeUndefined()
    for (const key of ['npm_config_cache', 'COREPACK_HOME', 'YARN_CACHE_FOLDER', 'YARN_GLOBAL_FOLDER']) {
      expect(path.relative(await realpath(root), result.env[key]!).startsWith('..')).toBe(false)
    }
    expect(base.npm_CONFIG_CACHE).toBe('old-cache')
    expect(base.DROP).toBe('remove')
  })

  it('rejects missing services, invalid enforcement and an unavailable canonical environment', async () => {
    const request = { argv: ['node', '--version'], cwd: process.cwd() }
    await expect(createProjectProcess(() => undefined)(request)).rejects.toThrow(/没有可用的进程沙箱/)
    const invalid = { confine: async () => ({ argv: [process.execPath], enforcement: 'invalid' as 'full' }) }
    await expect(createProjectProcess(() => invalid, async () => ({}))(request)).rejects.toThrow(/没有报告有效/)
    const provider = { confine: async (argv: readonly string[]) => ({ argv: [...argv], enforcement: 'full' as const }) }
    await expect(createProjectProcess(() => provider, async () => { throw new Error('environment unavailable') })(request)).rejects.toThrow('environment unavailable')
  })

  it('passes only prepared environment to the actual command, including checks', async () => {
    const root = await tmp('ac-boundary-env')
    const output = path.join(root, 'environment.txt')
    const prepare = vi.fn(async ({ argv }: { argv: readonly string[] }) => ({
      argv: projectCommandArgv(argv, root),
      env: { SystemRoot: process.env.SystemRoot, ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE, AC_PREPARED: 'yes' },
    }))
    const command = ['node', '-e', `require('node:fs').writeFileSync(${JSON.stringify(output)}, String(process.env.AC_PREPARED)+':'+String(process.env.CI))`]
    const result = await runProjectProcess(command, { cwd: root, env: { CI: 'must-not-leak' } }, prepare)
    expect(result.code).toBe(0)
    expect(await readFile(output, 'utf8')).toBe('yes:undefined')
    const checks = await runCommandChecks(root, { commands: [{ name: 'test', argv: command }] }, undefined, prepare)
    expect(checks[0]?.outcome).toBe('passed')
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ env: { CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' } }))
    const denied = await runCommandChecks(root, { commands: [{ name: 'test', argv: command }] })
    expect(denied[0]).toMatchObject({ outcome: 'failed', reason: expect.stringMatching(/写入边界/) })
  })
})
