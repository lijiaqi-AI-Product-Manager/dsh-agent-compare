// Check actual released record readers; keep future execution settings read-only
// in older releases instead of silently reinterpreting them.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertRunRecord } from '../lib/core/record-validation.js'
import { fixtureRecord } from '../test/record-fixture.ts'

const expected = '0f8a5b3dcbc24bd45bf915bab47f55e305e5505b0ae74efdabf16355bbd3723b'
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ac-release-record-check-'))
try {
  let bytes
  if (process.env.AGENT_COMPARE_PREVIOUS_RELEASE_ARCHIVE) bytes = await readFile(process.env.AGENT_COMPARE_PREVIOUS_RELEASE_ARCHIVE)
  else {
    const response = await fetch('https://registry.npmjs.org/dsh-agent-compare/-/dsh-agent-compare-1.1.0.tgz', { signal: AbortSignal.timeout(45_000) })
    assert.equal(response.status, 200, 'The exact previous public release must be available for this check')
    const chunks = []; let size = 0
    for await (const chunk of response.body) {
      size += chunk.length; assert.ok(size <= 2 * 1024 * 1024, 'The reference release exceeds its bounded size')
      chunks.push(chunk)
    }
    bytes = Buffer.concat(chunks)
  }
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, 'The reference must match the published release archive')
  const archive = path.join(temporary, 'reference.tgz'), extracted = path.join(temporary, 'release')
  await writeFile(archive, bytes); await mkdir(extracted)
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 }).trim().split(/\r?\n/)
  assert.ok(entries.every(entry => /^package\//.test(entry) && !entry.includes('\\') && !entry.split('/').includes('..')), 'Reference paths must stay in the package root')
  execFileSync('tar', ['-xzf', archive, '-C', extracted, '--strip-components=1'], { timeout: 15_000 })
  const previous = await import(pathToFileURL(path.join(extracted, 'lib/core/record-validation.js')).href)
  const record = fixtureRecord(); record.rev = 1
  previous.assertRunRecord(record, record.runId); assertRunRecord(record, record.runId)
  let protectedPolicies = 0
  for (const runtime of [{ windowsProcessCompat: 'auto' }, { windowsProcessCompat: 'off' }, { previewOriginMode: 'named-loopback' }, { previewOriginMode: 'dedicated-loopback' }]) {
    const current = structuredClone(record)
    Object.assign(current.acceptance.runtime, runtime)
    assertRunRecord(current, current.runId)
    assert.throws(() => previous.assertRunRecord(current, current.runId), /记录字段无效/, 'The older release must refuse an unknown execution condition')
    protectedPolicies++
  }
  const unknown = structuredClone(record); unknown.acceptance.runtime.previewOriginMode = 'unexpected'
  assert.throws(() => assertRunRecord(unknown, unknown.runId), /记录字段无效/)
  console.log(JSON.stringify({ referenceVersion: '1.1.0', referenceSha256: expected, priorRecordsReadable: true, unknownExecutionPoliciesReadOnlyInPriorRelease: protectedPolicies, invalidCurrentPolicyRejected: true }))
} finally {
  const resolved = await realpath(temporary), parent = await realpath(os.tmpdir())
  assert.equal(path.dirname(resolved), parent)
  assert.ok(path.basename(resolved).startsWith('ac-release-record-check-'))
  await rm(resolved, { recursive: true, force: true })
}
