import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chineseGuideAlias } from './chinese-guide-alias.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonical = ['README.md', 'README.en.md', 'README.ja.md', 'README.ko.md', 'README.es.md', 'README.pt-BR.md', 'README.fr.md', 'README.de.md']
const guides = [...canonical, 'README.zh.md']
const referenceDocs = ["docs/demo.md","docs/runs-and-recovery.md","docs/runs-and-recovery.en.md","docs/distribution.md","docs/distribution.en.md","docs/first-use.md","docs/safari-live-preview.md","docs/safari-live-preview.en.md","docs/windows-process-compat.md","docs/windows-process-compat.en.md","docs/quickstart.md","docs/quickstart.en.md","docs/maintenance.md","docs/maintenance.en.md","docs/package-managers.md"]
const repositoryOnlyDocs = new Set(['docs/demo.md', 'docs/first-use.md', 'docs/distribution.md', 'docs/distribution.en.md'])
const mediaFiles = ['docs/media/comparison-preview.gif', 'docs/media/comparison-workflow.mp4', 'docs/media/social-preview.png', 'docs/media/manifest.json', 'assets/icon.png', 'assets/icon.svg', 'screenshots.json', 'docs/media/screenshots/manifest.json', ...JSON.parse(await readFile(path.join(root, 'screenshots.json'), 'utf8'))]
const repositoryOnlyMedia = new Set(['docs/media/comparison-preview.gif', 'docs/media/comparison-workflow.mp4', 'docs/media/social-preview.png', 'docs/media/manifest.json'])
const packagedMedia = mediaFiles.filter(file => !repositoryOnlyMedia.has(file))
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const repository = manifest.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
const repositoryFiles = `${repository}/blob/main/`
const repositoryMedia = repository.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/main/'
const expectedTarball = `${manifest.name}-${manifest.version}.tgz`
const contents = new Map(await Promise.all([...guides, ...referenceDocs].map(async file => [file, await readFile(path.join(root, file), 'utf8')])))
assert.equal(contents.get('README.zh.md'), chineseGuideAlias(contents.get('README.md')), 'Run node scripts/sync-chinese-guide.mjs to update the Chinese section entry points')

const withoutCode = source => source.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '')
const slug = heading => heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-')
let localLinks = 0
for (const [file, source] of contents) {
  if (canonical.includes(file)) {
    const current = file === 'README.zh.md' ? 'README.md' : file
    for (const target of canonical) if (target !== current) assert.ok(source.includes(`](${target})`) || source.includes(`](${repositoryFiles}${target})`), `${file}: missing language link ${target}`)
    assert.ok(source.includes(manifest.version), `${file}: missing current version`)
    assert.ok(source.includes(`add ${manifest.name}@${manifest.version}`), `${file}: missing the current pinned npm installation target`)
    assert.ok(source.includes(`${repository}/issues/4`), `${file}: missing listing and review status records`)
    const archives = [...source.matchAll(/dsh-agent-compare-[\w.\-]+\.tgz/g)].map(match => match[0])
    assert.ok(archives.length > 0 && archives.every(name => name === expectedTarball), `${file}: missing or stale source-install archive`)
  }
  for (const match of withoutCode(source).matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1]
    const repositoryPath = href.startsWith(repositoryFiles) ? href.slice(repositoryFiles.length) : href.startsWith(repositoryMedia) ? href.slice(repositoryMedia.length) : undefined
    if (/^https?:\/\//.test(href) && repositoryPath === undefined) continue
    assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(repositoryPath ?? href), `${file}: unsupported link scheme`)
    const [relative, fragment] = (repositoryPath ?? href).split('#'), destination = path.resolve(root, repositoryPath === undefined ? path.dirname(file) : '.', decodeURIComponent(relative || path.basename(file)))
    assert.ok(destination.startsWith(root + path.sep), `${file}: local link escapes the repository`)
    assert.ok((await stat(destination)).isFile(), `${file}: missing link target ${href}`)
    if (fragment && destination.endsWith('.md')) {
      const target = withoutCode(await readFile(destination, 'utf8'))
      const anchors = new Set([...target.matchAll(/^#{1,6}\s+(.+)$/gm)].map(item => slug(item[1])))
      for (const item of target.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) anchors.add(item[1])
      assert.ok(anchors.has(decodeURIComponent(fragment)), `${file}: missing heading ${href}`)
    }
    localLinks++
  }
}

const recorded = JSON.parse(await readFile(path.join(root, 'docs/media/manifest.json'), 'utf8'))
assert.equal(recorded.schema, 'agentcompare.demo/v1')
assert.equal(recorded.files.length, 3)
assert.equal(new Set(recorded.files.map(file => file.path)).size, 3)
for (const asset of recorded.files) {
  assert.ok(mediaFiles.includes(`docs/media/${asset.path}`), 'Unexpected recorded asset')
  const bytes = await readFile(path.join(root, 'docs/media', asset.path))
  assert.equal(bytes.length, asset.bytes, `${asset.path}: recorded size differs`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.path}: recorded content differs`)
}

const firstUse = JSON.parse(await readFile(path.join(root, 'docs/measurements/first-use-2026-11-05.json'), 'utf8'))
assert.equal(firstUse.schema, 'agentcompare.first-use/v1')
assert.match(firstUse.source, /^[0-9a-f]{40}$/)
assert.match(firstUse.artifactSha256, /^[0-9a-f]{64}$/)
assert.equal(firstUse.runs.length, 3)
const summary = values => { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return { min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, max: sorted.at(-1) } }
assert.deepEqual(firstUse.summary.firstInteractiveMs, summary(firstUse.runs.map(run => run.firstInteractiveMs)))
assert.deepEqual(firstUse.summary.bothVerifiedMs, summary(firstUse.runs.map(run => run.bothVerifiedMs)))
assert.deepEqual(firstUse.summary.candidateTotalTokens, summary(firstUse.runs.flatMap(run => run.candidates.map(candidate => candidate.usage.totalTokens))))
for (const run of firstUse.runs) {
  assert.equal(run.adoption, 'adopted'); assert.equal(run.undo, 'reverted')
  assert.equal(run.candidates.length, 2)
  for (const candidate of run.candidates) {
    assert.equal(candidate.generation.ended, 'completed'); assert.equal(candidate.eligible, true)
    assert.equal(candidate.observed.incomplete, 0)
    assert.ok(candidate.checks.every(check => check.outcome === 'passed'))
    assert.equal(candidate.usage.kind, 'reported')
    const usage = candidate.usage
    assert.equal(usage.totalTokens, usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens)
    assert.ok(candidate.phases.generating <= firstUse.generationBudgetMs)
  }
}

assert.ok(process.env.npm_execpath, 'Run this check through npm run check:docs')
const result = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--ignore-scripts', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }))
const packages = Array.isArray(result) ? result : Object.values(result)
assert.equal(packages.length, 1, 'Expected one package')
const files = new Set(packages[0].files.map(file => file.path))
for (const file of [...guides, ...referenceDocs.filter(file => !repositoryOnlyDocs.has(file)), ...packagedMedia, 'CONTRIBUTING.md', 'LICENSE']) assert.ok(files.has(file), `Package omits ${file}`)
for (const file of repositoryOnlyDocs) assert.ok(!files.has(file), `Package repeats repository-only evidence or distribution notes: ${file}`)
for (const file of files) assert.ok(!repositoryOnlyMedia.has(file) && !file.startsWith('assets/readme/') && !file.startsWith('docs/measurements/'), 'Presentation-only media and research evidence must stay out of the runtime package')
assert.ok(packages[0].size <= 650_000, 'Compressed runtime package exceeds the 650 kB distribution budget')
console.log(JSON.stringify({ languages: canonical.length, guides: guides.length, referenceDocs: referenceDocs.length, localLinks, version: manifest.version, sourceInstallArchivesCurrent: true, packagedGuides: guides.length, recordedAssetsVerified: recorded.files.length, packageBytes: packages[0].size }))
