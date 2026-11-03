// Real host confinement with a controlled project; no provider credentials or
// model calls. Install the current host in the separate runtime directory.
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
import { fetchPreview } from '../lib/core/preview-url.js'
import { createExampleRepo } from '../lib/core/index.js'

const runtime = path.resolve(process.env.AGENT_COMPARE_DSH_RUNTIME ?? '.runtime-checks/host-sdk')
const resolveRuntime = createRequire(path.join(runtime, 'package.json'))
const load = name => import(pathToFileURL(resolveRuntime.resolve(name)).href)
const { Context } = await load('@deepseek-ai/cordis')
const { LocalSandboxProvider } = await load('@deepseek-ai/dsh-sandbox-local')
const { scrubbedParentEnv } = await load('@deepseek-ai/dsh-subprocess')
const hostVersion = JSON.parse(await readFile(resolveRuntime.resolve('@deepseek-ai/dsh/package.json'), 'utf8')).version
for (const name of ['dsh-sandbox', 'dsh-sandbox-local', 'dsh-subprocess']) {
  assert.equal(JSON.parse(await readFile(resolveRuntime.resolve(`@deepseek-ai/${name}/package.json`), 'utf8')).version, hostVersion, 'host packages must belong to one release')
}

// Place the negative canary outside platform-wide writable temp areas.
const base = path.resolve('.runtime-checks')
await mkdir(base, { recursive: true })
const root = await mkdtemp(path.join(base, 'native-'))
const ctx = new Context(), fiber = ctx.plugin(LocalSandboxProvider, {})
await fiber
let preview
const oldToken = process.env.AGENT_COMPARE_TEST_TOKEN, oldIdentity = process.env.DSH_RUNTIME_CHECK
try {
  const repo = await createExampleRepo(root), outside = path.join(root, 'outside.txt')
  await writeFile(outside, 'original')
  const prepare = createProjectProcess(() => ctx.get('sandbox'), async () => scrubbedParentEnv())
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
    preview = await startVitePreview(repo, { prepareProjectProcess: prepare, timeoutMs: 60000 })
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
  console.log(JSON.stringify({ host: hostVersion, node: process.version, vite: viteVersion, enforcement: prepared.enforcement, adjacentWriteDenied: true, environmentScrubbed: true, frozenInstall: true, checks: checks.map(check => `${check.name}:${check.outcome}`), previewStarts: 2, cancelledHeartbeatStopped: true }))
} finally {
  if (oldToken === undefined) delete process.env.AGENT_COMPARE_TEST_TOKEN; else process.env.AGENT_COMPARE_TEST_TOKEN = oldToken
  if (oldIdentity === undefined) delete process.env.DSH_RUNTIME_CHECK; else process.env.DSH_RUNTIME_CHECK = oldIdentity
  await preview?.stop()
  await fiber.dispose()
  const relative = path.relative(base, root)
  assert.ok(relative.startsWith('native-') && !relative.includes(path.sep) && !path.isAbsolute(relative))
  await rm(root, { recursive: true, force: true })
}
