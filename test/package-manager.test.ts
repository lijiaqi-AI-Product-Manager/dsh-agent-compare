import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inspectProject, installArgv, isBound, managerVersionIssue } from '../src/core/project.ts'

const root = await mkdtemp(path.join(os.tmpdir(), 'ac-manager-'))
let serial = 0
afterAll(async () => { if (!path.relative(os.tmpdir(), root).startsWith('..')) await rm(root, { recursive: true, force: true }) })
async function project(manager?: unknown, locks: Record<string, string> = {}) {
  const dir = path.join(root, String(++serial)); await mkdir(dir)
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { vite: 'latest' }, ...(manager === undefined ? {} : { packageManager: manager }) }))
  for (const [file, content] of Object.entries(locks)) await writeFile(path.join(dir, file), content)
  return inspectProject(dir)
}

describe('project package-manager selection', () => {
  it('requires the declared version and the correct Yarn generation', async () => {
    const modern = await project('yarn@4.18.1')
    expect(managerVersionIssue(modern, '4.18.1')).toBeUndefined()
    expect(managerVersionIssue(modern, '1.22.22')).toMatch(/未请求模型/)
    expect(managerVersionIssue(modern, undefined)).toMatch(/未报告/)
    expect(managerVersionIssue(await project(undefined, { 'yarn.lock': '__metadata:\n  version: 8\n' }), '1.22.22')).toMatch(/格式/)
  })
  it('reports the native Windows pnpm lock limitation without blocking Linux', async () => {
    const pnpm = await project('pnpm@12.16.1')
    expect(managerVersionIssue(pnpm, '12.16.1', 'win32')).toMatch(/存储锁.*不会放宽/)
    expect(managerVersionIssue(pnpm, '12.16.1', 'linux')).toBeUndefined()
  })
  it('uses an explicit supported declaration when several lockfiles remain', async () => {
    expect(await project('pnpm@12.16.1+sha512.abc123', { 'pnpm-lock.yaml': 'lockfileVersion: 9', 'package-lock.json': '{}' })).toMatchObject({ kind: 'vite', packageManager: 'pnpm', packageManagerVersion: '12.16.1', packageManagerSpec: 'pnpm@12.16.1+sha512.abc123', lockfile: 'pnpm-lock.yaml' })
  })
  it('rejects ambiguous locks and declared-manager conflicts', async () => {
    expect(await project(undefined, { 'pnpm-lock.yaml': '', 'yarn.lock': '' })).toMatchObject({ kind: 'unsupported', reason: expect.stringMatching(/多个/) })
    expect(await project('yarn@4.18.1', { 'package-lock.json': '{}' })).toMatchObject({ kind: 'unsupported', reason: expect.stringMatching(/yarn.lock/) })
  })
  it.each([null, 4, {}, 'bun@1.3.0', 'pnpm@latest', 'yarn@https://example.invalid/tool.js'])('does not silently reinterpret unsupported declaration %j', async manager => {
    expect(await project(manager)).toMatchObject({ kind: 'unsupported' })
  })
  it('distinguishes modern and classic Yarn locks without requiring a declaration', async () => {
    const modern = await project(undefined, { 'yarn.lock': '# Yarn lock\n__metadata:\n  version: 8\n' })
    const classic = await project(undefined, { 'yarn.lock': '# yarn lockfile v1\n' })
    expect(installArgv(modern)).toEqual({ argv: ['yarn', 'install', '--immutable'], frozen: true })
    expect(installArgv(classic)).toEqual({ argv: ['yarn', 'install', '--frozen-lockfile'], frozen: true })
  })
  it('warns about unverified modern dependency layouts before task submission', async () => {
    expect((await project('yarn@4.18.1', { 'yarn.lock': '__metadata:\n  version: 8\n' })).warning).toMatch(/PnP.*TypeScript 7/)
    expect((await project('yarn@4.18.1', { 'yarn.lock': '__metadata:\n  version: 8\n', '.yarnrc.yml': 'nodeLinker: node-modules\n' })).warning).toBeUndefined()
  })
  it('rejects a lock from another Yarn generation before installation', async () => {
    expect(await project('yarn@1.22.22', { 'yarn.lock': '__metadata:\n  version: 8\n' })).toMatchObject({ kind: 'unsupported', reason: expect.stringMatching(/格式/) })
    expect(await project('yarn@4.18.1', { 'yarn.lock': '# yarn lockfile v1\n' })).toMatchObject({ kind: 'unsupported' })
  })
  it('does not claim a lockless installation is frozen', async () => {
    const pnpm = installArgv(await project('pnpm@12.16.1')), yarn = installArgv(await project('yarn@4.18.1'))
    expect(pnpm.frozen).toBe(false); expect(pnpm.argv).not.toContain('--frozen-lockfile')
    expect(yarn.frozen).toBe(false); expect(yarn.argv).not.toContain('--immutable')
  })
  it.each(['pnpm-workspace.yaml', '.npmrc', '.yarnrc.yml', '.yarn/releases/yarn-4.cjs', '.yarn/plugins/custom.cjs', '.yarn/patches/library.patch'])('binds execution policy %s to the shared acceptance', file => {
    expect(isBound(file)).toBe(true)
  })
})
