import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url), packageFile = require.resolve('vitest/package.json')
const metadata = JSON.parse(await readFile(packageFile, 'utf8'))
const cli = path.resolve(path.dirname(packageFile), typeof metadata.bin === 'string' ? metadata.bin : metadata.bin.vitest)
const normalized = file => path.relative(root, file).replaceAll('\\', '/')
const expected = []
async function discover(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await discover(file)
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) expected.push(normalized(file))
  }
}
await discover(path.join(root, 'test'))
const selected = [], projects = []
for (const project of ['unit', 'integration']) {
  const files = JSON.parse(execFileSync(process.execPath, [cli, 'list', '--filesOnly', '--json', '--project', project], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 }))
  assert.ok(Array.isArray(files) && files.length, `${project}: expected test files`)
  for (const item of files) {
    assert.equal(item.projectName, project)
    selected.push(normalized(item.file))
  }
  projects.push({ name: project, files: files.length })
}
assert.equal(new Set(selected).size, selected.length, 'A test file belongs to multiple projects')
assert.deepEqual(selected.sort(), expected.sort(), 'The project split omitted or invented test files')
console.log(JSON.stringify({ testFiles: expected.length, projects, everyFileExactlyOnce: true }))
