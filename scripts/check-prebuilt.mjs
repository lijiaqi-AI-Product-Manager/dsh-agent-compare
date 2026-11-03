import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = args => execFileSync('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 })
const files = git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', 'lib']).toString('utf8').split('\0').filter(Boolean).sort()
assert.ok(files.length, 'Prebuilt runtime files must be committed')
const built = []
async function collect(relative) {
  for (const entry of await readdir(path.join(cwd, relative), { withFileTypes: true })) {
    const name = relative + '/' + entry.name
    if (entry.isDirectory()) await collect(name)
    else { assert.ok(entry.isFile(), `${name} must be a regular file`); built.push(name) }
  }
}
await collect('lib')
assert.deepEqual(built.sort(), files, 'Build output has missing or extra runtime files')
// Compare actual bytes with Git objects. Windows Git status can report a
// modification after a rebuild even when git diff finds no content change.
for (const file of files) assert.ok((await readFile(path.join(cwd, file))).equals(git(['show', 'HEAD:' + file])), `Build output differs: ${file}; rebuild and commit lib/ with the source change`)
console.log(JSON.stringify({ prebuiltRuntimeMatchesCommit: true, files: files.length }))
