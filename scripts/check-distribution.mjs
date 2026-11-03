import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const repo = 'https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare'
assert.equal(pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''), repo, 'npm must map to the canonical repository')
assert.equal(pkg.name, 'dsh-agent-compare')
assert.equal(pkg.license, 'MIT')
assert.ok(pkg.description.includes('DSH') && pkg.description.includes('DeepSeek Harness'))
assert.ok(['dsh', 'dsh-plugin', 'deepseek-harness'].every(keyword => pkg.keywords.includes(keyword)))
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.dsh.client.platform, 'web')
assert.ok(pkg.engines.dsh)
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
  assert.ok(!name.startsWith('@deepseek-ai/'), 'Host packages must stay in peerDependencies')
}
for (const name of Object.keys(pkg.peerDependencies)) {
  if (name.startsWith('@deepseek-ai/')) assert.equal(pkg.peerDependenciesMeta[name]?.optional, true)
}

async function localFile(relative) {
  assert.equal(typeof relative, 'string')
  assert.ok(relative.length && !relative.includes('\\') && !relative.split('/').includes('..') && !path.isAbsolute(relative), 'Asset paths must stay inside this repository')
  const file = path.resolve(root, relative)
  assert.ok(file.startsWith(root + path.sep))
  assert.ok((await lstat(file)).isFile(), `${relative} must be a regular file`)
  return readFile(file)
}

for (const entry of [pkg.main, pkg.types, pkg.exports['./client'], pkg.exports['./core'].default, pkg.exports['./core'].types, pkg.dsh.bundle.patch]) await localFile(entry.replace(/^\.\//, ''))
const patch = (await localFile('cordis.patch.yml')).toString('utf8')
assert.match(patch, /id: agent-compare\s/)
assert.match(patch, /name: ['"]?dsh-agent-compare['"]?\s/)
// A source dependency must run without requiring a build allowance.
assert.equal(pkg.scripts.prepare, undefined)
assert.equal(pkg.scripts.install, undefined)
assert.equal(pkg.scripts.postinstall, undefined)

function pngSize(bytes) {
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected a PNG image')
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
const icon = pngSize(await localFile('assets/icon.png'))
assert.equal(icon.width, icon.height, 'The storefront icon must be square')
assert.ok(icon.width >= 180 && icon.width <= 1024)

const screenshots = JSON.parse(await localFile('screenshots.json'))
assert.ok(Array.isArray(screenshots) && screenshots.length >= 1 && screenshots.length <= 8)
assert.equal(new Set(screenshots).size, screenshots.length)
const evidence = JSON.parse(await localFile('docs/media/screenshots/manifest.json'))
assert.equal(evidence.schema, 'agentcompare.screenshots/v1')
assert.equal(evidence.privatePathsHidden, true)
assert.deepEqual(screenshots, evidence.files.map(file => file.path))
for (const file of evidence.files) {
  const bytes = await localFile(file.path), size = pngSize(bytes)
  assert.ok(size.width >= 640 && size.height >= 360, 'Use readable product screenshots')
  assert.equal(bytes.length, file.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256)
}
assert.ok(pkg.files.includes('assets') && pkg.files.includes('screenshots.json'))
console.log(JSON.stringify({ package: pkg.name, version: pkg.version, bundle: true, prebuiltEntries: true, icon, screenshots: screenshots.length, screenshotSource: evidence.packageVersion }))
