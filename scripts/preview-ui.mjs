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
const done = { preparing: t(95, 94), generating: t(94, 40), sealing: t(40, 39), installing: t(39, 31), verifying: t(31, 26), previewing: t(26, 20), ready: t(20) }
const stepsAll = ['初始显示全部 8 个商品', '搜索 LAMP（不区分大小写）只剩 1 个', '搜索结果为 1 个', '点「清空」', '清空后恢复 8 个', '选分类 Desk', 'Desk 下有 2 个', 'Desk + 搜索 mat 组合生效', '组合结果为 1 个', '手机宽度', '手机上搜索框可见', '手机上分类按钮可见']
const steps = (missing) => stepsAll.map((label, i) => (missing && (i === 3 || i === 4) ? { label, ok: false, detail: i === 3 ? '找不到按钮' : '实际数量 1' } : { label, ok: true }))
const checks = (ok) => [
  { name: 'typecheck', outcome: 'passed', durationMs: 2100 },
  { name: 'build', outcome: 'passed', durationMs: 1800 },
  { name: 'browser', outcome: ok ? 'passed' : 'failed', durationMs: 6400, steps: steps(!ok), ...(ok ? {} : { reason: '验收步骤未通过：点「清空」（找不到按钮）' }) },
]
const acceptance = { source: 'repository', checks: ['typecheck', 'build', 'browser'], steps: 12, frozenInstall: true, sha256: 'abc' }
const base = { runId: '0a1b2c3d', task: '给商品列表加上搜索框和分类筛选，手机上也要好用。要求：搜索不区分大小写；分类可与搜索组合；有「清空」按钮；390px 手机可用。', mode: 'same-model', isolation: 'own-root', createdAt: now - 95000, baseline: { dirty: true }, acceptance }
const reported = { kind: 'reported', totalTokens: 48210 }
const A = { label: 'A', stage: 'ready', previewUrl: 'http://127.0.0.1:4318/a', previewKind: 'build', checks: checks(true), verdict: { eligible: true, reasons: [], warnings: [] }, patchStats: { files: 2, insertions: 48, deletions: 9, binary: 0 }, timings: done, usage: reported, hasScreenshot: false }
const B = { label: 'B', stage: 'ready', previewUrl: 'http://127.0.0.1:4318/b', previewKind: 'build', checks: checks(false), verdict: { eligible: false, reasons: ['页面验收未通过'], warnings: ['改动了依赖（已按锁文件安装）'] }, patchStats: { files: 3, insertions: 121, deletions: 4, binary: 0 }, timings: done, usage: { kind: 'reported', totalTokens: 71533 }, hasScreenshot: false }
const strat = { A: { strategy: { id: 'conservative', title: '稳妥 · Conservative' }, actualRoute: { provider: 'deepseek', model: 'deepseek-chat' }, summary: '在现有列表上方加了搜索框、分类按钮和清空按钮，沿用原有样式；手机上筛选区换行。' }, B: { strategy: { id: 'bold', title: '大胆 · Bold' }, actualRoute: { provider: 'deepseek', model: 'deepseek-chat' }, summary: '重做了列表顶部：分类改为可横向滚动的标签，搜索框吸顶。' } }
const history = [
  { ...base, runId: '11111111', state: 'adopted', choice: { pick: 'A' }, candidates: [] },
  { ...base, runId: '22222222', state: 'abandoned', task: '把设置页改成分组卡片布局，并加上保存成功提示', choice: { pick: 'none' }, candidates: [], createdAt: now - 86400000 },
]
const legacy = [{ runId: '1c1fe140', task: '给商品列表加上搜索框和分类筛选，手机上也要好用', createdAt: now - 2 * 86400000, state: 'revealed', legacy: true }]
const states = {
  start: [],
  history: [],
  running: [{ ...base, state: 'running', candidates: [
    { label: 'A', stage: 'verifying', timings: { preparing: t(50, 49), generating: t(49, 12), sealing: t(12, 11), installing: t(11, 6), verifying: t(6) } },
    { label: 'B', stage: 'generating', timings: { preparing: t(50, 49), generating: t(49) } },
  ] }],
  failed: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, { label: 'B', stage: 'failed', timings: { preparing: t(60, 59), generating: t(59, 20), sealing: t(20, 19), installing: t(19, 10) }, error: { stage: 'installing', message: '按锁文件 package-lock.json 冻结安装失败。改了依赖就必须同时更新锁文件，AgentCompare 不会换成非冻结安装。\nnpm ERR! `npm ci` can only install packages when your package.json and package-lock.json are in sync.' } }] }],
  judging: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, B] }],
  revealed: [{ ...base, state: 'revealed', checksFavoured: 'A', choice: { pick: 'B' }, revealedAt: now, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
  blocked: [{ ...base, state: 'revealed', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'blocked', mode: 'worktree', rehearsed: true, message: '把这一版接到你当前的项目上预演后，验收没有通过：test 未通过。尚未写入任何文件。', rehearsalChecks: [{ name: 'typecheck', outcome: 'passed', durationMs: 1 }, { name: 'test', outcome: 'failed', durationMs: 1 }, { name: 'build', outcome: 'passed', durationMs: 1 }] }, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
  adopted: [{ ...base, state: 'adopted', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'adopted', mode: 'worktree', rehearsed: true, message: '已写入 2 个文件，项目现在与预演通过的版本完全一致；未提交，index 和 HEAD 未改动' }, candidates: [{ ...A, ...strat.A, previewUrl: undefined }, { ...B, ...strat.B, previewUrl: undefined }] }],
  recovery: [{ ...base, state: 'recovery', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'needs-recovery', mode: 'worktree', message: '写入过程中宿主停止了。可以恢复到采用前，或保留当前文件。', attention: ['src/App.tsx'] }, candidates: [{ ...A, ...strat.A, previewUrl: undefined }, { ...B, ...strat.B, previewUrl: undefined }] }],
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
const history = ${JSON.stringify(history)};
const legacy = ${JSON.stringify(legacy)};
const models = [{ provider: 'deepseek', providerName: 'DeepSeek', id: 'deepseek-chat', name: 'DeepSeek V3' }, { provider: 'deepseek', providerName: 'DeepSeek', id: 'deepseek-reasoner', name: 'DeepSeek R1' }];
const realFetch = window.fetch;
window.fetch = async (url, init) => {
  const m = String(url).match(/agent-compare\\/api\\/(\\w+)/);
  if (!m) return realFetch(url, init);
  const value = m[1] === 'list' ? { runs: [...runs, ...history], legacy, isolation: 'own-root' }
    : m[1] === 'models' ? { current: { provider: 'deepseek', model: 'deepseek-chat' }, models }
    : runs[0] ?? null;
  return new Response(JSON.stringify({ ok: true, value }), { headers: { 'content-type': 'application/json' } });
};
window.__ModuleLoader__ = { load: ({ factory }) => {
  const mod = factory((id) => { if (id === 'react') return React; throw new Error('unexpected require ' + id) });
  const regs = {};
  mod.apply({ slots: { inject: (n, cb) => cb(), register: (spec, C) => { regs[spec.name] = { spec, C }; return () => {} } } });
  const h = regs['conversation.session.header.utilities'], o = regs['shell.overlay'];
  ReactDOM.createRoot(document.getElementById('btn')).render(React.createElement(h.C, h.spec.inject('s1')));
  ReactDOM.createRoot(document.getElementById('overlay')).render(React.createElement(o.C, o.spec.inject()));
  if (${JSON.stringify(state !== 'closed')}) setTimeout(() => {
    document.querySelector('.ac-header-btn').click();
    if (${JSON.stringify(state === 'history')}) setTimeout(() => [...document.querySelectorAll('.ac-tab')].at(-1).click(), 300);
  }, 50);
} };
</script><script src="/lib/client.js"></script></body></html>`

const demo = (label) => `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:system-ui;padding:24px;background:#fff">
<h2 style="margin:0 0 12px">Demo Shop · ${label}</h2><input type="search" placeholder="搜索商品" style="padding:8px;border:1px solid #ccc;border-radius:6px;width:260px">
<div style="display:flex;gap:6px;margin-top:10px">${['Audio', 'Desk', 'Bags', 'Light'].map((c) => `<button aria-pressed="false">${c}</button>`).join('')}${label === 'A' ? '<button>清空</button>' : ''}</div>
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
console.log('preview: http://127.0.0.1:4317/?state=start|history|running|judging|failed|revealed|blocked|adopted|recovery&theme=light|dark')
