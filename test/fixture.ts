/**
 * An offline "Vite project": the `vite` dependency is a local stub package
 * installed through `file:`, whose bin implements `build` (copy index.html to
 * dist) and `preview`/dev (serve over HTTP, print the Local URL). Everything
 * else is real: npm ci against a lockfile, scripts, processes, git.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { git } from '../src/core/git.ts'
import { run } from '../src/core/proc.ts'
import type { PrepareProjectProcess } from '../src/core/project-process.ts'

/** Only for the repository's trusted offline fixtures; this does not test confinement. */
export const prepareFixtureProcess: PrepareProjectProcess = async ({ argv, env }) => ({ argv, env: { ...process.env, ...env } })

const STUB_BIN = `#!/usr/bin/env node
const fs = require('fs'), path = require('path'), http = require('http')
const args = process.argv.slice(2)
if (args[0] === 'build') {
  fs.mkdirSync('dist', { recursive: true })
  fs.copyFileSync('index.html', path.join('dist', 'index.html'))
  console.log('built')
  process.exit(0)
}
const port = Number(args[args.indexOf('--port') + 1])
const root = args[0] === 'preview' ? 'dist' : '.'
http.createServer((q, s) => {
  fs.readFile(path.join(root, q.url === '/' ? 'index.html' : q.url), (e, b) => {
    if (e) { s.statusCode = 404; return s.end() }
    s.setHeader('content-type', 'text/html'); s.end(b)
  })
}).listen(port, '127.0.0.1', () => console.log('  Local:   http://127.0.0.1:' + port + '/'))
`

/** test script: fails when index.html says BROKEN, or when NEW meets flag.txt (a combination-only failure). */
const CHECK = `const fs = require('fs')
const html = fs.readFileSync('index.html', 'utf8')
if (html.includes('BROKEN')) { console.error('index.html is broken'); process.exit(1) }
if (html.includes('NEW') && fs.existsSync('flag.txt')) { console.error('NEW does not work with flag.txt'); process.exit(1) }
console.log('ok')
`

export async function tmp(prefix: string): Promise<string> {
  // A space in the path exercises quoting on every platform.
  return mkdtemp(path.join(os.tmpdir(), `${prefix} `))
}

export async function fixtureRepo(): Promise<string> {
  const repo = await tmp('ac-fixture')
  await mkdir(path.join(repo, 'vendor', 'vite', 'bin'), { recursive: true })
  await writeFile(path.join(repo, 'vendor', 'vite', 'package.json'), JSON.stringify({ name: 'vite', version: '0.0.0-stub', bin: { vite: 'bin/vite.js' } }))
  await writeFile(path.join(repo, 'vendor', 'vite', 'bin', 'vite.js'), STUB_BIN)
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({
    name: 'fixture-shop',
    private: true,
    version: '0.0.0',
    scripts: { test: 'node check.cjs', build: 'node node_modules/vite/bin/vite.js build' },
    devDependencies: { vite: 'file:vendor/vite' },
  }, null, 2))
  await writeFile(path.join(repo, 'index.html'), '<h1>shop</h1>\n')
  await writeFile(path.join(repo, 'check.cjs'), CHECK)
  await writeFile(path.join(repo, 'keep.txt'), 'keep\n')
  await writeFile(path.join(repo, '.gitignore'), 'node_modules/\ndist/\n')
  const lock = await run(['npm', 'install', '--no-audit', '--no-fund', '--offline'], { cwd: repo, timeoutMs: 120_000 })
  if (lock.code !== 0) throw new Error(`fixture npm install failed: ${lock.stderr}`)
  await git(repo, ['init', '-q', '-b', 'main'])
  await git(repo, ['config', 'user.email', 't@example.com'])
  await git(repo, ['config', 'user.name', 't'])
  await git(repo, ['config', 'core.autocrlf', 'false'])
  await git(repo, ['add', '-A'])
  await git(repo, ['commit', '-q', '-m', 'init'])
  return repo
}
