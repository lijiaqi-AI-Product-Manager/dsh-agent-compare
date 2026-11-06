import { describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseAcceptanceConfig } from '../src/core/acceptance-config.ts'
import { acceptanceChanges, buildAcceptance, inspectProject } from '../src/core/project.ts'
import { git } from '../src/core/git.ts'
import { fixtureRepo } from './fixture.ts'

describe('acceptance configuration', () => {
  const available = { build: 'vite build', 'test:e2e': 'playwright test' }
  it('accepts bounded browser behavior, explicit helpers, and available scripts', () => {
    const config = { scripts: ['test:e2e'], protectedFiles: ['custom/fixture.json'], browser: { path: '/shop?query=lamp', mobileShot: false, steps: [{ fill: 'input', text: '' }, { expectCount: '.card', max: 0 }, { viewport: { width: 390, height: 844 } }, { press: 'input', key: 'Enter' }] } }
    expect(parseAcceptanceConfig(config, available)).toEqual(config)
  })
  it.each([
    null, [], { browsers: {} }, { scripts: ['missing'] }, { scripts: ['build', 'build'] }, { scripts: 'build' },
    { protectedFiles: ['../check.cjs'] }, { protectedFiles: ['C:/check.cjs'] }, { protectedFiles: ['custom\\check.cjs'] }, { protectedFiles: ['src/**'] },
    { browser: { path: 'https://example.invalid/' } }, { browser: { path: '//example.invalid/' } }, { browser: { path: '/\\example.invalid' } },
    { browser: { mobileShot: 'false' } }, { browser: { steps: [{ click: 'button', fill: 'input', text: 'x' }] } },
    { browser: { steps: [{ expectVisible: 'input', max: 1 }] } }, { browser: { steps: [{ fill: 'input' }] } },
    { browser: { steps: [{ expectCount: '.card' }] } }, { browser: { steps: [{ expectCount: '.card', min: 3, max: 2 }] } },
    { browser: { steps: [{ expectCount: '.card', min: -1 }] } }, { browser: { steps: [{ viewport: { width: 0, height: 844 } }] } },
    { browser: { steps: [{ viewport: { width: 390, height: Infinity } }] } }, { browser: { steps: Array.from({ length: 101 }, () => ({ click: 'button' })) } },
  ])('rejects an invalid or ambiguous definition before execution: %j', (value) => {
    expect(() => parseAcceptanceConfig(value, available)).toThrow(/\.agent-compare\.json/)
  })
})

describe('acceptance integrity', () => {
  it('binds the Windows mode into the shared acceptance identity', async () => {
    const repo = await fixtureRepo(), tree = (await git(repo, ['rev-parse', 'HEAD^{tree}'])).trim(), info = await inspectProject(repo)
    const automatic = await buildAcceptance(repo, tree, info, undefined, 'auto')
    const disabled = await buildAcceptance(repo, tree, info, undefined, 'off')
    expect(disabled.runtime.windowsProcessCompat).toBe('off')
    expect(automatic.sha256).not.toBe(disabled.sha256)
    expect((await buildAcceptance(repo, tree, info, undefined, 'off')).sha256).toBe(disabled.sha256)
  })
  it('binds root verification helpers and detects new configuration and lifecycle scripts', async () => {
    const repo = await fixtureRepo()
    const base = (await git(repo, ['rev-parse', 'HEAD^{tree}'])).trim()
    const info = await inspectProject(repo)
    const acceptance = await buildAcceptance(repo, base, info)
    expect(acceptance.bound['check.cjs']).toMatch(/^[0-9a-f]+$/)
    await writeFile(path.join(repo, 'check.cjs'), 'process.exit(0)\n')
    await writeFile(path.join(repo, 'vitest.config.ts'), 'export default { test: { passWithNoTests: true } }\n')
    const pkg = JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8'))
    pkg.scripts.pretest = 'node check.cjs'
    pkg.scripts.postinstall = 'node check.cjs'
    await writeFile(path.join(repo, 'package.json'), JSON.stringify(pkg))
    await git(repo, ['add', '-A'])
    const candidate = (await git(repo, ['write-tree'])).trim()
    const changed = await acceptanceChanges(repo, acceptance, base, candidate)
    expect(changed.touched).toEqual(expect.arrayContaining(['check.cjs', 'vitest.config.ts', 'package.json scripts.pretest', 'package.json scripts.postinstall']))
  })
  it('binds explicit data helpers and rejects a misspelled helper path', async () => {
    const repo = await fixtureRepo()
    await writeFile(path.join(repo, '.agent-compare.json'), JSON.stringify({ protectedFiles: ['keep.txt'] }))
    await git(repo, ['add', '-A'])
    const base = (await git(repo, ['write-tree'])).trim()
    const info = await inspectProject(repo)
    expect((await buildAcceptance(repo, base, info)).bound['keep.txt']).toMatch(/^[0-9a-f]+$/)
    await writeFile(path.join(repo, '.agent-compare.json'), JSON.stringify({ protectedFiles: ['missing.txt'] }))
    await git(repo, ['add', '-A'])
    const invalid = (await git(repo, ['write-tree'])).trim()
    await expect(buildAcceptance(repo, invalid, info)).rejects.toThrow(/基线中不存在 missing.txt/)
  })
  it('rejects malformed package structures without crashing project discovery', async () => {
    const repo = await fixtureRepo()
    for (const pkg of [null, [], { scripts: [] }, { scripts: { test: 12 } }, { dependencies: { vite: false } }]) {
      await writeFile(path.join(repo, 'package.json'), JSON.stringify(pkg))
      expect(await inspectProject(repo)).toMatchObject({ kind: 'unsupported', reason: expect.stringMatching(/package.json/) })
    }
  })
})
