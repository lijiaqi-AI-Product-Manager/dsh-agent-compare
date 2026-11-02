// Visual harness for the client sheet, with no DSH and no model:
//   node scripts/preview-ui.mjs   then open http://127.0.0.1:4317/?state=judging
// It loads the real lib/client.js through a stand-in __ModuleLoader__ and
// answers agent-compare/api/* with fixed sample runs. Sample data only.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const now = Date.now()
const t = (a, b) => ({ startedAt: now - a * 1000, ...(b === undefined ? {} : { endedAt: now - b * 1000 }) })
const done = { worktree: t(95, 94), generating: t(94, 40), capturing: t(40, 39), installing: t(39, 31), starting: t(31, 30), checking: t(30, 22), ready: t(22) }
const checks = (tc) => [
  { name: 'typecheck', outcome: tc, durationMs: 2100, ...(tc === 'failed' ? { reason: "src/App.tsx(20,14): error TS2322: Type 'string' is not assignable to type 'number'." } : {}) },
  { name: 'build', outcome: 'passed', durationMs: 1800 },
  { name: 'browser', outcome: 'passed', durationMs: 2400 },
]
const base = { runId: '0a1b2c3d', task: '给商品列表加上搜索框和分类筛选，手机上也要好用', mode: 'same-model', createdAt: now - 95000, baseline: { dirty: true } }
const unknown = { kind: 'unknown', reason: 'not reported' }
const A = { label: 'A', stage: 'ready', previewUrl: 'http://127.0.0.1:4318/a', checks: checks('passed'), patchStats: { files: 2, insertions: 48, deletions: 9, binary: 0 }, timings: done, usage: unknown }
const B = { label: 'B', stage: 'ready', previewUrl: 'http://127.0.0.1:4318/b', checks: checks('failed'), patchStats: { files: 1, insertions: 21, deletions: 4, binary: 0 }, timings: done, usage: unknown }
const strat = { A: { strategy: { id: 'bold', title: '大胆 · Bold' }, summary: '重做了列表顶部：分类改为可横向滚动的标签，搜索框吸顶，手机上单列展示。' }, B: { strategy: { id: 'conservative', title: '稳妥 · Conservative' }, summary: '在现有列表上方加了搜索框和下拉筛选，沿用原有样式。' } }
const states = {
  start: [],
  running: [{ ...base, state: 'running', candidates: [
    { label: 'A', stage: 'installing', timings: { worktree: t(50, 49), generating: t(49, 12), capturing: t(12, 11), installing: t(11) } },
    { label: 'B', stage: 'generating', timings: { worktree: t(50, 49), generating: t(49) } },
  ] }],
  failed: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, { label: 'B', stage: 'failed', timings: { worktree: t(60, 59), generating: t(59, 20), capturing: t(20, 19), installing: t(19, 10), starting: t(10, 2) }, error: { stage: 'starting', message: 'dev server exited before it answered\n\n[vite] Internal server error: Failed to resolve import "./Filters" from "src/App.tsx". Does the file exist?' } }] }],
  judging: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, B] }],
  revealed: [{ ...base, state: 'revealed', checksFavoured: 'A', choice: { pick: 'B' }, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
  adopted: [{ ...base, state: 'adopted', checksFavoured: 'A', choice: { pick: 'A' }, adoption: { state: 'adopted', mode: 'worktree', message: '2 file(s) written and verified against the checked candidate; nothing was committed', verification: [{ name: 'target', outcome: 'skipped', durationMs: 0, reason: 'your checkout has no node_modules' }] }, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
}

const page = (state, theme) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>AgentCompare preview</title>
<style>body{margin:0;font-family:system-ui,'Microsoft YaHei',sans-serif;background:${theme === 'dark' ? '#111317' : '#f5f6f8'};height:100vh}
.titlebar{height:40px;display:flex;align-items:center;gap:16px;padding:0 16px;font-size:13px;color:#888;border-bottom:1px solid rgba(128,128,128,.2)}
.header{display:flex;align-items:center;gap:12px;padding:10px 20px;font-weight:600;color:${theme === 'dark' ? '#eee' : '#111'}}
${theme === 'dark' ? ':root{--dsw-alias-bg-base:#1b1d22;--dsw-alias-bg-layer-1:#22252b;--dsw-alias-bg-layer-2:#2a2e35;--dsw-alias-label-primary:#eceef2;--dsw-alias-label-secondary:#b4b9c3;--dsw-alias-label-tertiary:#7d8490;--dsw-alias-border-l2:rgba(255,255,255,.09);--dsw-alias-border-l3:rgba(255,255,255,.15);--dsw-alias-interactive-bg-hover:rgba(255,255,255,.06);--dsw-alias-bg-mask-1:rgba(0,0,0,.5)}' : ''}</style>
<script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script></head>
<body><div class="titlebar">（模拟桌面标题栏 40px）应用 编辑</div><div class="header">Session Title <span id="btn"></span></div><div id="overlay"></div>
<script>
const runs = ${JSON.stringify(states[state] ?? [])};
const realFetch = window.fetch;
window.fetch = async (url, init) => {
  const m = String(url).match(/agent-compare\\/api\\/(\\w+)/);
  if (!m) return realFetch(url, init);
  const value = m[1] === 'list' ? runs : runs[0] ?? null;
  return new Response(JSON.stringify({ ok: true, value }), { headers: { 'content-type': 'application/json' } });
};
window.__ModuleLoader__ = { load: ({ factory }) => {
  const mod = factory((id) => { if (id === 'react') return React; throw new Error('unexpected require ' + id) });
  const regs = {};
  mod.apply({ slots: { inject: (n, cb) => cb(), register: (spec, C) => { regs[spec.name] = { spec, C }; return () => {} } } });
  const h = regs['conversation.session.header.utilities'], o = regs['shell.overlay'];
  ReactDOM.createRoot(document.getElementById('btn')).render(React.createElement(h.C, h.spec.inject('s1')));
  ReactDOM.createRoot(document.getElementById('overlay')).render(React.createElement(o.C, o.spec.inject()));
  if (${JSON.stringify(state !== 'closed')}) setTimeout(() => document.querySelector('.ac-header-btn').click(), 50);
} };
</script><script src="/lib/client.js"></script></body></html>`

const demo = (label) => `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:system-ui;padding:24px;background:#fff">
<h2 style="margin:0 0 12px">Demo Shop · ${label}</h2><input placeholder="Search products" style="padding:8px;border:1px solid #ccc;border-radius:6px;width:260px">
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:14px">${['Studio Headphones', 'Pocket Speaker', 'Monitor Stand', 'Desk Mat', 'Backpack', 'Desk Lamp'].map((n) => `<div style="border:1px solid #e3e6ea;border-radius:8px;padding:10px">${n}</div>`).join('')}</div>`

const vendor = { 'react.js': 'node_modules/react/umd/react.development.js', 'react-dom.js': 'node_modules/react-dom/umd/react-dom.development.js' }
createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  try {
    if (u.pathname === '/') return res.end(page(u.searchParams.get('state') ?? 'judging', u.searchParams.get('theme') ?? 'light'))
    if (u.pathname.startsWith('/vendor/')) return res.end(await readFile(path.join(root, vendor[u.pathname.slice(8)])))
    if (u.pathname === '/lib/client.js') return res.end(await readFile(path.join(root, 'lib/client.js')))
    res.statusCode = 404
    res.end()
  } catch (e) { res.statusCode = 500; res.end(String(e)) }
}).listen(4317, '127.0.0.1')
createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(demo(req.url.includes('b') ? 'B' : 'A')) }).listen(4318, '127.0.0.1')
console.log('preview: http://127.0.0.1:4317/?state=start|running|judging|failed|revealed|adopted&theme=light|dark')
