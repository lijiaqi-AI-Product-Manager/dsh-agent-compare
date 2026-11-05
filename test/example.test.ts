import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createExampleRepo, exampleTask } from '../src/core/example.ts'
import { git } from '../src/core/git.ts'
import { tmp } from './fixture.ts'

describe('built-in example scope', () => {
  it('binds distinct common acceptance before generation and preserves the complete case', async () => {
    const root = await tmp('ac-example-scope')
    const [quick, full, original] = await Promise.all([
      createExampleRepo(root, undefined, 'quick'), createExampleRepo(root, undefined, 'full'), createExampleRepo(root),
    ])
    expect(new Set([quick, full, original]).size).toBe(3)
    const spec = async (repo: string) => JSON.parse(await readFile(path.join(repo, '.agent-compare.json'), 'utf8'))
    expect((await spec(quick)).browser.steps).toHaveLength(5)
    expect((await spec(full)).browser.steps).toHaveLength(12)
    expect(await spec(original)).toEqual(await spec(full))
    expect(exampleTask('quick')).not.toBe(exampleTask('full'))
    expect(await readFile(path.join(quick, 'src/App.tsx'), 'utf8')).toBe(await readFile(path.join(full, 'src/App.tsx'), 'utf8'))
    expect(await git(quick, ['status', '--porcelain'])).toBe('')
    expect(await git(full, ['status', '--porcelain'])).toBe('')
  })
})
