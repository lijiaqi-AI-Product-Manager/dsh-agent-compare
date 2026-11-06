// Real host confinement with a controlled project; no provider credentials or
// model calls. Install the selected host in the separate runtime directory.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createProjectProcess } from '../lib/host/project-process.js'
import { runProjectProcess } from '../lib/core/project-process.js'
import { runCommandChecks } from '../lib/core/checks.js'
import { inspectProject, installArgv } from '../lib/core/project.js'
import { startVitePreview } from '../lib/core/preview.js'
import { fetchPreview, isNumericPreviewHost } from '../lib/core/preview-url.js'
import { createExampleRepo } from '../lib/core/index.js'

const runtime = path.resolve(process.env.AGENT_COMPARE_DSH_RUNTIME ?? '.runtime-checks/host-sdk')
const numericHosts=process.env.AGENT_COMPARE_RUNTIME_PREVIEW_HOSTS?.split(',')
if(numericHosts)assert.ok(numericHosts.length===2&&new Set(numericHosts).size===2&&numericHosts.every(isNumericPreviewHost))
const resolveRuntime = createRequire(path.join(runtime, 'package.json'))
const load = name => import(pathToFileURL(resolveRuntime.resolve(name)).href)
const { Context } = await load('@deepseek-ai/cordis')
const { LocalSandboxProvider } = await load('@deepseek-ai/dsh-sandbox-local')
const { scrubbedParentEnv } = await load('@deepseek-ai/dsh-subprocess')
const hostVersion = JSON.parse(await readFile(resolveRuntime.resolve('@deepseek-ai/dsh/package.json'), 'utf8')).version
for (const name of ['dsh-sandbox', 'dsh-sandbox-local', 'dsh-subprocess']) {
  assert.equal(JSON.parse(await readFile(resolveRuntime.resolve(`@deepseek-ai/${name}/package.json`), 'utf8')).version, hostVersion, 'host packages must belong to one release')
}

const { evaluatePluginCompatibility } = await load('@deepseek-ai/dsh-app-boot')
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const admitted = ['0.2.1-rc.3', '0.2.1-rc.5', '0.2.1', '0.2.2-alpha.3', '0.2.2-rc.1', '0.2.2', '0.2.3-rc.1']
const rejected = ['0.2.0', '0.2.1-rc.2', '0.3.0-alpha.1', '0.3.0-rc.1', '0.3.0', '1.0.0']
for (const version of admitted) assert.equal(evaluatePluginCompatibility(manifest, {}, version), undefined, version)
for (const version of rejected) assert.ok(evaluatePluginCompatibility(manifest, {}, version)?.requirements['engines.dsh'], version)
assert.equal(evaluatePluginCompatibility(manifest, {}, hostVersion), undefined, 'the executing host must admit this package')
console.log(JSON.stringify({ host: hostVersion, compatibilityRange: manifest.engines.dsh, admitted, rejected }))

// Place the negative canary outside platform-wide writable temp areas.
const base = path.resolve(process.env.AGENT_COMPARE_RUNTIME_WORK ?? '.runtime-checks')
await mkdir(base, { recursive: true })
const root = await mkdtemp(path.join(base, 'native-'))
const ctx = new Context(), fiber = ctx.plugin(LocalSandboxProvider, {})
await fiber
let preview
const oldToken = process.env.AGENT_COMPARE_TEST_TOKEN, oldIdentity = process.env.DSH_RUNTIME_CHECK
try {
  const repo = await createExampleRepo(root), outside = path.join(root, 'outside.txt')
  await writeFile(outside, 'original')
  const prepare = createProjectProcess(() => ctx.get('sandbox'), async () => scrubbedParentEnv(), process.platform === 'win32' ? resolveRuntime.resolve('@deepseek-ai/dsh-win32-process') : undefined)
  process.env.AGENT_COMPARE_TEST_TOKEN = 'local-environment-canary'
  process.env.DSH_RUNTIME_CHECK = 'local-identity-canary'
  const prepared = await prepare({ argv: ['node', '--version'], cwd: repo })
  assert.ok(['full', 'partial'].includes(prepared.enforcement))
  const code = `const fs=require('node:fs');fs.writeFileSync('.vite-canary','inside');let denied=false;try{fs.writeFileSync(${JSON.stringify(outside)},'changed')}catch(e){denied=true}console.log(JSON.stringify({denied,token:!!process.env.AGENT_COMPARE_TEST_TOKEN,identity:!!process.env.DSH_RUNTIME_CHECK}))`
  const guarded = await runProjectProcess(['node', '-e', code], { cwd: repo, timeoutMs: 30000 }, prepare)
  assert.equal(guarded.code, 0, guarded.stderr)
  assert.deepEqual(JSON.parse(guarded.stdout.trim()), { denied: true, token: false, identity: false })
  assert.equal(await readFile(outside, 'utf8'), 'original')
  assert.equal(await readFile(path.join(repo, '.vite-canary'), 'utf8'), 'inside')
  await rm(path.join(repo, '.vite-canary'))

  // A permitted dependency lifecycle must work inside the same boundary.
  // npm 12's default script policy hid this npm 11 desktop failure path.
  const lifecycle = path.join(root, 'lifecycle'), dependency = path.join(lifecycle, 'dependency')
  await mkdir(dependency, { recursive: true })
  const marker = path.join(lifecycle, 'installed.marker')
  const dependencyName = 'agent-compare-lifecycle-fixture'
  const dependencySpec = `file:${dependencyName}-1.0.0.tgz`
  const lifecycleManifest = { name: 'agent-compare-lifecycle-project', version: '1.0.0', private: true,
    dependencies: { [dependencyName]: dependencySpec }, allowScripts: { [dependencySpec]: true } }
  await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: dependencyName, version: '1.0.0', scripts: { postinstall: 'node install.cjs' } }))
  await writeFile(path.join(dependency, 'install.cjs'), "require('node:fs').writeFileSync(process.env.AGENT_COMPARE_LIFECYCLE_MARKER,'permitted lifecycle completed');console.log('lifecycle-fixture-completed')\n")
  await writeFile(path.join(lifecycle, 'package.json'), JSON.stringify(lifecycleManifest))
  const lifecycleRun = argv => runProjectProcess(argv, { cwd: lifecycle, timeoutMs: 120000, env: { CI: '1', AGENT_COMPARE_LIFECYCLE_MARKER: marker } }, prepare)
  // A tarball exercises installation without requiring symlink privileges in
  // the Windows runner's restricted token.
  const fixturePack = await lifecycleRun(['npm', 'pack', './dependency', '--ignore-scripts', '--pack-destination', '.'])
  assert.equal(fixturePack.code, 0, fixturePack.stderr || fixturePack.stdout)
  const lock = await lifecycleRun(['npm', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'])
  assert.equal(lock.code, 0, lock.stderr || lock.stdout)
  const lockedBytes = await readFile(path.join(lifecycle, 'package-lock.json'), 'utf8')
  const lifecycleInstall = await lifecycleRun(['npm', 'ci', '--no-audit', '--no-fund'])
  assert.equal(lifecycleInstall.code, 0, lifecycleInstall.stderr || lifecycleInstall.stdout)
  assert.equal(await readFile(marker, 'utf8'), 'permitted lifecycle completed')
  await rm(marker)
  const ignored = await lifecycleRun(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'])
  assert.equal(ignored.code, 0, ignored.stderr || ignored.stdout)
  await assert.rejects(readFile(marker), { code: 'ENOENT' })
  lifecycleManifest.allowScripts[dependencySpec] = false
  await writeFile(path.join(lifecycle, 'package.json'), JSON.stringify(lifecycleManifest))
  const denied = await lifecycleRun(['npm', 'ci', '--no-audit', '--no-fund'])
  assert.equal(denied.code, 0, denied.stderr || denied.stdout)
  await assert.rejects(readFile(marker), { code: 'ENOENT' })
  assert.equal(await readFile(path.join(lifecycle, 'package-lock.json'), 'utf8'), lockedBytes, 'Lifecycle handling must not relax or rewrite the lock')

  // Explicitly permit a current native dependency so npm 12 exercises the
  // same nested-process path as older package managers instead of skipping it.
  const esbuildProject = path.join(root, 'esbuild')
  await mkdir(esbuildProject)
  await writeFile(path.join(esbuildProject, 'package.json'), JSON.stringify({ name: 'agent-compare-esbuild-runtime', private: true, dependencies: { esbuild: '0.28.2' }, allowScripts: { esbuild: true } }))
  for (const argv of [
    ['npm', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    ['npm', 'ci', '--no-audit', '--no-fund'],
    ['node', '-e', "const e=require('esbuild');Promise.all(Array.from({length:16},(_,i)=>e.transform('const n: number = '+i,{loader:'ts'}))).then(r=>{if(r.length!==16||r.some(x=>!x.code.includes('const n')))process.exitCode=1;return e.transformSync('let n: number=1',{loader:'ts'})}).then(r=>{if(!r.code.includes('let n'))process.exitCode=1})"],
  ]) {
    const result = await runProjectProcess(argv, { cwd: esbuildProject, timeoutMs: 120000, env: { CI: '1' } }, prepare)
    assert.equal(result.code, 0, result.stderr || result.stdout)
  }
  if (process.platform === 'win32') {
    const pipes = await runProjectProcess(['node', path.resolve('scripts/check-windows-pipes.cjs'), outside], { cwd: esbuildProject, timeoutMs: 30000 }, prepare)
    assert.equal(pipes.code, 0, pipes.stderr || pipes.stdout)
    assert.equal(JSON.parse(pipes.stdout.trim()).restrictedGrandchild, true)
    assert.equal(await readFile(outside, 'utf8'), 'original')
  }

  const install = installArgv(await inspectProject(repo))
  assert.ok(install.frozen)
  const installed = await runProjectProcess(install.argv, { cwd: repo, timeoutMs: 600000, env: { CI: '1' } }, prepare)
  assert.equal(installed.code, 0, installed.stderr || installed.stdout)
  const checks = await runCommandChecks(repo, { commands: [
    { name: 'typecheck', argv: ['npm', 'run', 'typecheck'] },
    { name: 'build', argv: ['npm', 'run', 'build'] },
  ] }, undefined, prepare)
  assert.ok(checks.every(check => check.outcome === 'passed'), JSON.stringify(checks))
  const viteVersion = JSON.parse(await readFile(path.join(repo, 'node_modules/vite/package.json'), 'utf8')).version
  for (let i = 0; i < 2; i++) {
    preview = await startVitePreview(repo, { prepareProjectProcess: prepare, timeoutMs: 60000, ...(numericHosts?{loopbackHost:numericHosts[i]}:{}) })
    if(numericHosts)assert.equal(new URL(preview.url).hostname,numericHosts[i])
    const response = await fetchPreview(preview.url)
    assert.equal(response.status, 200)
    assert.ok((await response.text()).includes('id="root"'))
    await preview.stop(); preview = undefined
  }

  const heartbeat = path.join(repo, '.cancel-heartbeat'), controller = new AbortController()
  const pending = runProjectProcess(['node', '-e', "const fs=require('node:fs');let n=0;const tick=()=>fs.writeFileSync('.cancel-heartbeat',String(++n));tick();setInterval(tick,25)"], { cwd: repo, timeoutMs: 30000, signal: controller.signal }, prepare)
  void pending.catch(() => {})
  try {
    const until = Date.now() + 15000
    while (Date.now() < until) {
      try { await readFile(heartbeat); break } catch { await new Promise(resolve => setTimeout(resolve, 50)) }
    }
    await readFile(heartbeat)
  } finally { controller.abort() }
  assert.ok((await pending).aborted)
  const stopped = await readFile(heartbeat, 'utf8')
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(await readFile(heartbeat, 'utf8'), stopped, 'cancelled process must stop writing')
  console.log(JSON.stringify({ host: hostVersion, node: process.version, vite: viteVersion, enforcement: prepared.enforcement, adjacentWriteDenied: true, environmentScrubbed: true, permittedLifecycleCompleted: true, ignoredLifecycleSkipped: true, deniedLifecycleSkipped: true, lifecycleLockUnchanged: true, nativeEsbuildLifecycle: true, asyncAndSyncTransforms: true, frozenInstall: true, checks: checks.map(check => `${check.name}:${check.outcome}`), previewStarts: 2, cancelledHeartbeatStopped: true }))
} finally {
  if (oldToken === undefined) delete process.env.AGENT_COMPARE_TEST_TOKEN; else process.env.AGENT_COMPARE_TEST_TOKEN = oldToken
  if (oldIdentity === undefined) delete process.env.DSH_RUNTIME_CHECK; else process.env.DSH_RUNTIME_CHECK = oldIdentity
  await preview?.stop()
  await fiber.dispose()
  const relative = path.relative(base, root)
  assert.ok(relative.startsWith('native-') && !relative.includes(path.sep) && !path.isAbsolute(relative))
  await rm(root, { recursive: true, force: true })
}
