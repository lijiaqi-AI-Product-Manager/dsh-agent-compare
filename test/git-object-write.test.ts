import { describe, expect, it, vi } from 'vitest'
import { withGitObjectWriteRetry } from '../src/core/git-object-write.ts'

const hash = 'd'.repeat(38)
const collision = (object = `.git/objects/29/${hash}`) => new Error(`git write-tree exited 128: error: unable to write file ${object}: Permission denied\nfatal: git-write-tree: error building trees`)

describe('Windows Git loose-object writes', () => {
  it.each([`.git/objects/29/${hash}`, `.git\\objects\\29\\${hash}`, `.git/objects/29/${'d'.repeat(62)}`])('recovers from a temporary sharing conflict at %s', async object => {
    const operation = vi.fn().mockRejectedValueOnce(collision(object)).mockRejectedValueOnce(collision(object)).mockResolvedValue('tree')
    expect(await withGitObjectWriteRetry(operation, 'win32')).toBe('tree')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('surfaces the final failure after three attempts', async () => {
    const error = collision(), operation = vi.fn().mockRejectedValue(error)
    await expect(withGitObjectWriteRetry(operation, 'win32')).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it.each(['linux', 'darwin'] as const)('does not retry on %s', async platform => {
    const error = collision(), operation = vi.fn().mockRejectedValue(error)
    await expect(withGitObjectWriteRetry(operation, platform)).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it.each([
    new Error('spawn git ENOENT'),
    new Error('git write-tree exited signal: operation cancelled'),
    new Error('git write-tree exited 128: fatal: Unable to create index.lock: File exists'),
    new Error('git add -A exited 128: error: open keep.txt: Permission denied'),
    new Error(`git write-tree exited 128: error: unable to write file .git/objects/pack/pack-${hash}.pack: Permission denied`),
    new Error('git write-tree exited 128: fatal: invalid object'),
  ])('does not retry unrelated failures: %s', async error => {
    const operation = vi.fn().mockRejectedValue(error)
    await expect(withGitObjectWriteRetry(operation, 'win32')).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('runs a successful operation once', async () => {
    const operation = vi.fn().mockResolvedValue('tree')
    expect(await withGitObjectWriteRetry(operation, 'win32')).toBe('tree')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
