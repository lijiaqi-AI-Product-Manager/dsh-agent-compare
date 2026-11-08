/** Where a comparison works: a repository's project, a private workspace for any other folder, and enabling Git on request. */
import { describe, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, readdir, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { git, headCommit } from '../src/core/git.ts'
import * as gitModule from '../src/core/git.ts'
import { checkEnableGit, createPrivateWorkspace, enableGit, resolveWorkspace } from '../src/core/workspace.ts'
import { tmp } from './fixture.ts'

async function repository(): Promise<string> {
  const repo = await tmp('ac-ws-repo')
  await git(repo, ['init', '-q'])
  await mkdir(path.join(repo, 'apps', 'web'), { recursive: true })
  return repo
}

describe('workspace resolution', () => {
  it('uses a repository and its project subfolder, and a folder anywhere else', async () => {
    expect(await resolveWorkspace(undefined)).toEqual({ kind: 'folder' })
    const plain = await tmp('ac-ws-plain')
    expect(await resolveWorkspace(plain)).toEqual({ kind: 'folder', folder: path.resolve(plain) })
    const repo = await repository()
    expect(await resolveWorkspace(repo)).toMatchObject({ kind: 'repository', projectPath: '' })
    expect(await resolveWorkspace(path.join(repo, 'apps', 'web'))).toMatchObject({ kind: 'repository', projectPath: 'apps/web' })
    await expect(resolveWorkspace(path.join(plain, 'missing'))).rejects.toThrow(/找不到/)
  })

  it('reports a Git failure other than "not a repository" instead of hiding the project', async () => {
    const plain = await tmp('ac-ws-git-fails')
    const lookup = vi.spyOn(gitModule, 'repoRoot').mockRejectedValue(new Error('git rev-parse exited 128: fatal: detected dubious ownership'))
    try { await expect(resolveWorkspace(plain)).rejects.toThrow(/dubious ownership/) }
    finally { lookup.mockRestore() }
  })

  it('creates a private workspace without user templates or hooks', async () => {
    const dir = path.join(await tmp('ac-ws-private'), 'ws')
    const root = await createPrivateWorkspace(dir)
    expect(path.relative(await realpath(root), await realpath(dir))).toBe('')
    expect(await headCommit(root)).toBeUndefined()
    expect(existsSync(path.join(dir, '.git', 'hooks'))).toBe(false)
  })
})

describe('enabling Git in a folder', () => {
  it('refuses the home folder, a drive root and folders already in a repository', async () => {
    expect(await checkEnableGit(os.homedir())).toMatchObject({ ok: false, reason: expect.stringMatching(/主目录/) })
    expect(await checkEnableGit(path.parse(os.tmpdir()).root)).toMatchObject({ ok: false, reason: expect.stringMatching(/根目录/) })
    const repo = await repository()
    expect(await checkEnableGit(path.join(repo, 'apps'))).toMatchObject({ ok: false, reason: expect.stringMatching(/已经在 Git 仓库中/) })
    expect(await checkEnableGit(path.join(repo, 'nothing-here'))).toMatchObject({ ok: false, reason: expect.stringMatching(/找不到/) })
  })

  it('counts exactly what a comparison would copy and refuses folders over the limits', async () => {
    const folder = await tmp('ac-ws-count')
    for (const file of ['index.html', 'app.js', 'style.css']) await writeFile(path.join(folder, file), 'x')
    await mkdir(path.join(folder, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(path.join(folder, 'node_modules', 'pkg', 'index.js'), 'ignored')
    await mkdir(path.join(folder, 'cache'))
    await writeFile(path.join(folder, 'cache', 'big.bin'), Buffer.alloc(4096))
    await writeFile(path.join(folder, '.gitignore'), 'cache/\n')
    // index.html, app.js, style.css, .gitignore — dependency folders and ignored files are left out.
    expect(await checkEnableGit(folder)).toMatchObject({ ok: true, files: 4 })
    expect(await checkEnableGit(folder, { limits: { files: 3, bytes: 1_000_000 } })).toMatchObject({ ok: false, reason: expect.stringMatching(/超过 3 个的上限/) })
    expect(await checkEnableGit(folder, { limits: { files: 100, bytes: 2 } })).toMatchObject({ ok: false, reason: expect.stringMatching(/MB/) })
    expect(existsSync(path.join(folder, '.git'))).toBe(false)
  })

  it('refuses a large folder without root ignore rules quickly, without waiting for Git', async () => {
    const folder = await tmp('ac-ws-large')
    await mkdir(path.join(folder, 'cache'))
    for (let i = 0; i < 30; i++) await writeFile(path.join(folder, 'cache', `f${i}.txt`), 'x')
    // A virtual environment ignores itself and a nested repository counts once.
    await mkdir(path.join(folder, '.venv'))
    await writeFile(path.join(folder, '.venv', '.gitignore'), '*\n')
    for (let i = 0; i < 30; i++) await writeFile(path.join(folder, '.venv', `lib${i}.py`), 'x')
    await mkdir(path.join(folder, 'cloned'))
    await git(path.join(folder, 'cloned'), ['init', '-q'])
    for (let i = 0; i < 30; i++) await writeFile(path.join(folder, 'cloned', `src${i}.ts`), 'x')
    const started = Date.now()
    expect(await checkEnableGit(folder, { limits: { files: 20, bytes: 1_000_000 } })).toMatchObject({ ok: false, reason: expect.stringMatching(/超过 20 个的上限/) })
    expect(Date.now() - started).toBeLessThan(5_000)
    // The same folder fits once the plain cache is the only content above the limit.
    expect(await checkEnableGit(folder, { limits: { files: 40, bytes: 1_000_000 } })).toMatchObject({ ok: true })
  })

  it('creates a repository without committing or changing a file', async () => {
    const folder = await tmp('ac-ws-enable')
    await writeFile(path.join(folder, 'index.html'), '<h1>mine</h1>')
    const before = await readdir(folder)
    await enableGit(folder)
    expect((await readdir(folder)).filter(name => name !== '.git')).toEqual(before)
    expect(await headCommit(folder)).toBeUndefined()
    expect(await resolveWorkspace(folder)).toMatchObject({ kind: 'repository', projectPath: '' })
    await expect(enableGit(folder)).rejects.toThrow(/已经在 Git 仓库中/)
  })
})
