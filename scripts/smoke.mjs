// End-to-end smoke run of the AgentCompare core WITHOUT a model: a scripted
// runner plays the two agents, everything else is real (git snapshot,
// worktrees, npm install, Vite dev servers, checks, headless browser, adoption).
//
//   node scripts/smoke.mjs            both candidates valid
//   node scripts/smoke.mjs --break B  candidate B ships a type error
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Comparer, RunStore, publicView } from '../lib/core/index.js'
import { git } from '../lib/core/git.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const breakLabel = process.argv.includes('--break') ? process.argv[process.argv.indexOf('--break') + 1] : undefined
// --escape B: candidate B also writes a file in the repository root, outside its copy.
const escapeLabel = process.argv.includes('--escape') ? process.argv[process.argv.indexOf('--escape') + 1] : undefined
const keep = process.argv.includes('--keep')

const SEARCH = `import { useState } from 'react'
import { products } from './products'

export function App() {
  const [q, setQ] = useState('')
  const shown = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <main className="page">
      <h1>Demo Shop</h1>
      <input aria-label="search" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="grid">
        {shown.map((p) => (
          <li key={p.id} className="card"><strong>{p.name}</strong><span>¥{p.price}</span></li>
        ))}
      </ul>
    </main>
  )
}
`
const CHIPS = (broken) => `import { useState } from 'react'
import { products, type Product } from './products'

const CATS: Array<Product['category'] | 'All'> = ['All', 'Audio', 'Desk', 'Bags', 'Light']

export function App() {
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [sort, setSort] = useState<'price' | 'rating'>('rating')
  const shown = products.filter((p) => cat === 'All' || p.category === cat).sort((a, b) => (sort === 'price' ? a.price - b.price : b.rating - a.rating))
  ${broken ? "const oops: number = 'type error on purpose'" : ''}
  return (
    <main className="page">
      <h1>Demo Shop</h1>
      <nav className="chips">{CATS.map((c) => <button key={c} aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>)}</nav>
      <select aria-label="sort" value={sort} onChange={(e) => setSort(e.target.value as 'price' | 'rating')}><option value="rating">Top rated</option><option value="price">Lowest price</option></select>
      <ul className="grid">{shown.map((p) => <li key={p.id} className="card"><strong>{p.name}</strong><span>¥{p.price}</span></li>)}</ul>
    </main>
  )
}
`

/** Plays both agents by writing files; reports usage as unknown, exactly like a provider that reports nothing. */
const runner = {
  async run(req) {
    const started = Date.now()
    const conservative = req.prompt.includes('Strategy: CONSERVATIVE')
    await new Promise((r) => setTimeout(r, 300))
    const broken = breakLabel === req.label ? "\nexport const oops: number = 'type error on purpose'\n" : ''
    await writeFile(path.join(req.cwd, 'src', 'App.tsx'), (conservative ? SEARCH : CHIPS(false)) + broken)
    if (escapeLabel === req.label) await writeFile(path.join(req.cwd, '..', '..', '..', 'ESCAPED.md'), 'written outside the copy\n')
    if (!conservative) await writeFile(path.join(req.cwd, 'src', 'styles.css'), (await readFile(path.join(req.cwd, 'src', 'styles.css'), 'utf8')) + '.chips { display: flex; gap: 8px; margin-bottom: 12px; }\n')
    return { stopReason: 'completed', summary: `${conservative ? 'search box' : 'category chips + sort'} (${Date.now() - started} ms)`, usage: { kind: 'unknown', reason: 'scripted runner' } }
  },
}

const repo = await mkdtemp(path.join(os.tmpdir(), 'ac smoke repo '))
await cp(path.join(here, '..', 'examples', 'vite-react-demo'), repo, { recursive: true, filter: (src) => !/node_modules|[\\/]dist([\\/]|$)/.test(src) })
await git(repo, ['init', '-q', '-b', 'main'])
await git(repo, ['add', '-A'])
await git(repo, ['-c', 'user.name=smoke', '-c', 'user.email=smoke@localhost', 'commit', '-q', '-m', 'demo'])
// An uncommitted user edit that must survive adoption untouched.
await writeFile(path.join(repo, 'NOTES.md'), 'my uncommitted notes\n')

const home = await mkdtemp(path.join(os.tmpdir(), 'ac smoke home '))
const t0 = Date.now()
const comparer = new Comparer({ store: new RunStore(home), runner, version: 'smoke', previewTimeoutMs: 90_000 })
const started = await comparer.start({ repo, task: 'Let shoppers find products faster on the product list page.' })
console.log(`run ${started.runId}: baseline ${started.baseline.dirty ? 'dirty' : 'clean'}, checks ${started.checks.commands.map((c) => c.name).join('+')}+browser`)
const done = await comparer.wait(started.runId)
const view = publicView(done)
for (const c of view.candidates) {
  const t = c.timings
  const secs = (s) => (t[s]?.endedAt && t[s]?.startedAt ? ((t[s].endedAt - t[s].startedAt) / 1000).toFixed(1) + 's' : '-')
  console.log(`  ${c.label}: ${c.stage} url=${c.previewUrl ?? '-'} install=${secs('installing')} start=${secs('starting')} checks=${(c.checks ?? []).map((r) => `${r.name}:${r.outcome}${r.outcome === 'passed' ? '' : `(${(r.reason ?? r.tail).split('\n')[0].slice(0, 160)})`}`).join(',')} ${c.error ? 'error=' + c.error.message.split('\n')[0] : ''}`)
}
console.log(`  checks favoured: ${done.checksFavoured}; first both-settled after ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`  copies: ${done.candidates.map((c) => path.relative(repo, c.worktree ?? '?')).join(', ')}`)
console.log(`  outside changes: ${JSON.stringify(done.outsideChanges ?? [])}`)
if (!done.candidates.every((c) => c.worktree?.startsWith(path.join(repo, '.agents', 'worktrees')))) throw new Error('copies are not inside the repository pool')
if (escapeLabel && !(done.outsideChanges ?? []).includes('ESCAPED.md')) throw new Error('outside write was not detected')
if (JSON.stringify(view).match(/conservative|bold/i)) throw new Error('blind view leaked the strategy')

const pick = done.candidates.find((c) => c.stage === 'ready')?.label
if (!pick) throw new Error('no candidate became ready')
await comparer.choose(started.runId, pick)
const revealed = await comparer.reveal(started.runId)
console.log(`  picked ${pick} -> ${revealed.candidates.find((c) => c.label === pick).strategy.id}`)
const adopted = await comparer.adopt(started.runId, 'worktree', { verify: false })
console.log(`  adoption: ${adopted.state} - ${adopted.adoption?.message}`)
const notes = await readFile(path.join(repo, 'NOTES.md'), 'utf8')
if (notes !== 'my uncommitted notes\n') throw new Error('user edit was not preserved')
const status = await git(repo, ['status', '--porcelain'])
console.log(`  target status after adoption:\n${status.trimEnd().split('\n').map((l) => '    ' + l).join('\n')}`)
if (!keep) await comparer.cleanup(started.runId)
await comparer.dispose()
console.log(keep ? `kept: repo=${repo} home=${home}` : 'cleaned up candidate worktrees and dev servers')
