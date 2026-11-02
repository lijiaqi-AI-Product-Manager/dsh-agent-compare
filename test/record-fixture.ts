import path from 'node:path'
import os from 'node:os'
import { RUN_SCHEMA, type RunRecord } from '../src/core/types.ts'

/** Complete serialized facts; no process or worktree is created by this fixture. */
export function fixtureRecord(runId = '0a1b2c3d'): RunRecord {
  const root = path.join(os.tmpdir(), 'ac-record-fixture'), artifacts = path.join(root, 'a', runId)
  const record: RunRecord = {
    schema: RUN_SCHEMA, producer: { name: 'dsh-agent-compare', version: 'test' }, runId, createdAt: 1, updatedAt: 1, rev: 0,
    task: 'Add search', sessionId: 'session-one', mode: 'same-model', isolation: 'own-root', budget: { generationMs: 1000 }, state: 'judging',
    baseline: { repoRoot: path.join(root, 'repo'), headCommit: 'a'.repeat(40), snapshotCommit: 'b'.repeat(40), snapshotTree: 'c'.repeat(40), dirty: true },
    acceptance: {
      checks: { commands: [{ name: 'build', argv: ['npm', 'run', 'build'] }], browser: { path: '/', steps: [{ expectVisible: 'input' }] } },
      scripts: { build: 'vite build' }, bound: { 'vite.config.ts': 'd'.repeat(40) }, lockfile: 'package-lock.json',
      runtime: { node: process.version, packageManager: 'npm', platform: process.platform }, source: 'repository', sha256: 'e'.repeat(64),
    },
    candidates: ['A', 'B'].map(label => ({
      label: label as 'A' | 'B', strategy: { id: label, title: label, instruction: '' }, route: { provider: 'fixture', model: 'fixture' }, stage: 'ready',
      dir: path.join(root, 'w', runId, label), ownerToken: 'a'.repeat(24), candidateCommit: '1'.repeat(40), candidateTree: '2'.repeat(40), checkedTree: '2'.repeat(40),
      patchFile: path.join(artifacts, `${label}.patch`), patchSha256: '3'.repeat(64), patchStats: { files: 1, insertions: 2, deletions: 0, binary: 0 },
      touchedFiles: ['src/App.tsx'], acceptanceTouched: [], drift: [], generation: { ended: 'completed' },
      install: { argv: ['npm', 'ci'], frozen: true, durationMs: 10, outcome: 'passed' }, execution: { enforcement: 'partial' },
      checks: [{ name: 'build', outcome: 'passed', durationMs: 10, tail: '' }], usage: { kind: 'unknown', reason: 'not reported' },
      verdict: { eligible: true, reasons: [], warnings: [] }, timings: { generating: { startedAt: 1, endedAt: 2 } },
    })),
  }
  return record
}
