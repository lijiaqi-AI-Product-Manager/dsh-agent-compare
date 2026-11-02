// End-to-end smoke run of the AgentCompare core WITHOUT a model: a scripted
// runner plays the two agents, everything else is real (git snapshot, owned
// copies, frozen npm install, Vite build, `vite preview`, the example's
// scripted browser acceptance in a system browser, rehearsal and adoption).
//
// Candidate A delivers every requirement of the built-in case. Candidate B
// forgets the 「清空」 button, so the acceptance must catch it.
//
//   node scripts/smoke.mjs             run, adopt A, clean up
//   node scripts/smoke.mjs --escape B  B also writes outside its copy (must be detected)
//   node scripts/smoke.mjs --keep      keep the repo, copies and previews
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { Comparer, RunStore, publicView, createExampleRepo, EXAMPLE_TASK } from '../lib/core/index.js'
import { git } from '../lib/core/git.js'

const escapeLabel = process.argv.includes('--escape') ? process.argv[process.argv.indexOf('--escape') + 1] : undefined
const keep = process.argv.includes('--keep')

const app = (withClear) => `import { useMemo, useState } from 'react'
import { products, type Product } from './products'

const CATS: Product['category'][] = ['Audio', 'Desk', 'Bags', 'Light']

export function App() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Product['category'] | null>(null)
  const shown = useMemo(
    () => products.filter((p) => (cat === null || p.category === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [q, cat],
  )
  return (
    <main className="page">
      <h1>Demo Shop</h1>
      <div className="filters">
        <input type="search" aria-label="搜索商品" placeholder="搜索商品" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {CATS.map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</button>
          ))}
        </div>
${withClear ? "        <button className=\"clear\" onClick={() => { setQ(''); setCat(null) }}>清空</button>\n" : ''}      </div>
      <ul className="grid">
        {shown.map((p) => (
          <li key={p.id} className="card" data-testid="product-card">
            <span className="category">{p.category}</span>
            <strong>{p.name}</strong>
            <span>¥{p.price}</span>
            <span className="rating">★ {p.rating}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
`
const CSS = '\n.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }\n.filters input { flex: 1 1 220px; font-size: 16px; padding: 8px 10px; }\n.chips { display: flex; gap: 6px; flex-wrap: wrap; }\n.chips button[aria-pressed="true"] { background: #222; color: #fff; }\n'

/** Plays both agents by writing files; reports usage as unknown, exactly like a provider that reports nothing. */
const runner = {
  isolation: 'own-root',
  async run(req) {
    const started = Date.now()
    const complete = req.label === 'A'
    await writeFile(path.join(req.cwd, 'src', 'App.tsx'), app(complete))
    await writeFile(path.join(req.cwd, 'src', 'styles.css'), (await readFile(path.join(req.cwd, 'src', 'styles.css'), 'utf8')) + CSS)
    if (escapeLabel === req.label) await writeFile(path.join(repo, 'ESCAPED.md'), 'written outside the copy\n')
    return { stopReason: 'completed', summary: `${complete ? 'search + filters + clear' : 'search + filters'} (${Date.now() - started} ms)`, usage: { kind: 'unknown', reason: 'scripted runner' } }
  },
}

const home = await mkdtemp(path.join(os.tmpdir(), 'ac smoke home '))
const repo = await createExampleRepo(path.join(home, 'examples'))
// Include uncommitted notes in the baseline, then edit them again before adoption.
await writeFile(path.join(repo, 'NOTES.md'), 'my uncommitted notes\n')

const t0 = Date.now()
// This script executes only its own trusted fixture. Host confinement is
// checked separately inside a real supported host, not claimed by this smoke.
const comparer = new Comparer({ store: new RunStore(home), runner, version: 'smoke', previewTimeoutMs: 90_000,
  prepareProjectProcess: async ({ argv, env }) => ({ argv, env: { ...process.env, ...env } }),
})
const started = await comparer.start({ repo, task: EXAMPLE_TASK, assignment: 'fixed' })
console.log(`run ${started.runId}: isolation ${started.isolation}, acceptance ${started.acceptance.source} (${started.acceptance.checks.commands.map((c) => c.name).join('+')}+browser, ${started.acceptance.checks.browser?.steps?.length ?? 0} steps)`)
const done = await comparer.wait(started.runId)
const view = publicView(done)
for (const c of view.candidates) {
  const t = c.timings
  const secs = (s) => (t[s]?.endedAt && t[s]?.startedAt ? ((t[s].endedAt - t[s].startedAt) / 1000).toFixed(1) + 's' : '-')
  const steps = c.checks?.find((k) => k.name === 'browser')?.steps
  console.log(`  ${c.label}: ${c.stage} ${c.previewKind ?? ''} url=${c.previewUrl ?? '-'} install=${secs('installing')} verify=${secs('verifying')} preview=${secs('previewing')}`)
  console.log(`     checks=${(c.checks ?? []).map((r) => `${r.name}:${r.outcome}`).join(',')} steps=${steps ? `${steps.filter((s) => s.ok).length}/${steps.length}` : '-'} eligible=${c.verdict?.eligible} ${c.verdict?.reasons.join('；') ?? ''}${c.error ? ' error=' + c.error.message.split('\n')[0] : ''}`)
}
console.log(`  checks favoured: ${done.checksFavoured}; both settled after ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`  copies: ${done.candidates.map((c) => c.dir).join(', ')}`)
console.log(`  outside changes: ${JSON.stringify(done.outsideChanges ?? [])}`)
if (done.candidates.some((c) => path.relative(repo, c.dir ?? repo).startsWith('..') === false)) throw new Error('own-root copies must live outside the repository')
if (escapeLabel && !(done.outsideChanges ?? []).includes('ESCAPED.md')) throw new Error('outside write was not detected')
if (JSON.stringify(view).match(/conservative|bold/i)) throw new Error('blind view leaked the strategy')
const [a, b] = done.candidates
if (a.verdict?.eligible !== true) throw new Error(`A should pass the acceptance: ${a.verdict?.reasons.join('; ')}`)
const browserRan = b.checks?.some((k) => k.name === 'browser' && k.outcome !== 'skipped')
if (browserRan && b.verdict?.eligible !== false) throw new Error('B forgot the clear button; the acceptance must not pass it')

const currentNotes = 'my uncommitted notes\nupdated after the baseline\n'
await writeFile(path.join(repo, 'NOTES.md'), currentNotes)
await comparer.choose(started.runId, 'A')
const adopted = await comparer.adopt(started.runId, 'worktree')
console.log(`  adoption: ${adopted.adoption?.state} (rehearsed: ${adopted.adoption?.rehearsal?.reused === false}) - ${adopted.adoption?.message}`)
if (adopted.adoption?.state !== 'adopted') throw new Error('adoption did not complete')
if (adopted.adoption.rehearsal?.reused !== false) throw new Error('the changed checkout was not rehearsed')
const notes = await readFile(path.join(repo, 'NOTES.md'), 'utf8')
if (notes !== currentNotes) throw new Error('user edit was not preserved')
const status = await git(repo, ['status', '--porcelain'])
console.log(`  target status after adoption:\n${status.trimEnd().split('\n').map((l) => '    ' + l).join('\n')}`)
if (!keep) await comparer.cleanup(started.runId)
await comparer.dispose()
console.log(keep ? `kept: repo=${repo} home=${home}` : 'released copies and previews')
