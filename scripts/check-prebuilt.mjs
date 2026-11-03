import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
assert.ok(git(['ls-files', '--', 'lib']).trim(), 'Prebuilt runtime files must be tracked')
assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'lib']).trim(), '', 'Build output differs from the committed runtime; rebuild and include lib/ with the source change')
console.log(JSON.stringify({ prebuiltRuntimeMatchesCommit: true }))
