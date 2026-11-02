// Visual harness for the client sheet, with no DSH and no model:
//   node scripts/preview-ui.mjs   then open http://127.0.0.1:4317/?state=judging
// It loads the real lib/client.js through a stand-in __ModuleLoader__ and
// answers agent-compare/api/* with fixed sample runs. Sample data only.
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import { RunStore } from '../lib/core/run-store.js'
import { PreferencesStore } from '../lib/host/preferences.js'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
const base = { runId: '0a1b2c3d', task: '给商品列表加上搜索框和分类筛选，手机上也要好用。要求：搜索不区分大小写；分类可与搜索组合；有「清空」按钮；390px 手机可用。', mode: 'same-model', isolation: 'own-root', createdAt: now - 95000, baseline: { dirty: true, repoRoot: 'D:\\Projects\\demo-shop' }, acceptance }
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
  blank: [],
  'blank-history': [{ ...base, state: 'judging', candidates: [A, B] }],
  guide: [],
  running: [{ ...base, state: 'running', candidates: [
    { label: 'A', stage: 'verifying', timings: { preparing: t(50, 49), generating: t(49, 12), sealing: t(12, 11), installing: t(11, 6), verifying: t(6) } },
    { label: 'B', stage: 'generating', timings: { preparing: t(50, 49), generating: t(49) }, progress: { steps: 5, lastAction: 'write src\\App.tsx', lastActivityAt: now - 150_000, tokens: 61240 } },
  ] }],
  inline: [{ ...base, state: 'judging', origin: { kind: 'command' }, checksFavoured: 'A', candidates: [A, B] }],
  allfailed: [{ ...base, state: 'judging', checksFavoured: 'none', candidates: [
    { label: 'A', stage: 'failed', timings: { preparing: t(1890, 1889), generating: t(1889, 2) }, usage: { kind: 'reported', totalTokens: 233363 }, salvageable: false, generation: { ended: 'budget' }, error: { stage: 'sealing', message: '超出生成时间预算（30 分钟）时还没有改动任何文件。' } },
    { label: 'B', stage: 'failed', timings: { preparing: t(1910, 1909), generating: t(1909, 2) }, usage: { kind: 'reported', totalTokens: 257649 }, salvageable: true, error: { stage: 'generating', message: '超出生成时间预算（30 分钟），已停止这个候选' } },
  ] }],
  failed: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, { label: 'B', stage: 'failed', timings: { preparing: t(60, 59), generating: t(59, 20), sealing: t(20, 19), installing: t(19, 10) }, error: { stage: 'installing', message: '按锁文件 package-lock.json 冻结安装失败。改了依赖就必须同时更新锁文件，AgentCompare 不会换成非冻结安装。\nnpm ERR! `npm ci` can only install packages when your package.json and package-lock.json are in sync.' } }] }],
  judging: [{ ...base, state: 'judging', checksFavoured: 'A', candidates: [A, B] }],
  revealed: [{ ...base, state: 'revealed', checksFavoured: 'A', choice: { pick: 'B' }, revealedAt: now, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
  blocked: [{ ...base, state: 'revealed', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'blocked', mode: 'worktree', rehearsed: true, message: '把这一版接到你当前的项目上预演后，验收没有通过：test 未通过。尚未写入任何文件。', rehearsalChecks: [{ name: 'typecheck', outcome: 'passed', durationMs: 1 }, { name: 'test', outcome: 'failed', durationMs: 1 }, { name: 'build', outcome: 'passed', durationMs: 1 }] }, candidates: [{ ...A, ...strat.A }, { ...B, ...strat.B }] }],
  adopted: [{ ...base, state: 'adopted', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'adopted', mode: 'worktree', rehearsed: true, message: '已写入 2 个文件，项目现在与预演通过的版本完全一致；未提交，index 和 HEAD 未改动' }, candidates: [{ ...A, ...strat.A, previewUrl: undefined }, { ...B, ...strat.B, previewUrl: undefined }] }],
  recovery: [{ ...base, state: 'recovery', checksFavoured: 'A', choice: { pick: 'A' }, revealedAt: now, adoption: { state: 'needs-recovery', mode: 'worktree', message: '写入过程中宿主停止了。可以恢复到采用前，或保留当前文件。', attention: ['src/App.tsx'] }, candidates: [{ ...A, ...strat.A, previewUrl: undefined }, { ...B, ...strat.B, previewUrl: undefined }] }],
}

const page = (state, theme, error) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>AgentCompare client harness</title>
<style>body{margin:0;font:14px system-ui,'Microsoft YaHei',sans-serif;background:${theme === 'dark' ? '#111317' : '#f5f6f8'};color:${theme === 'dark' ? '#eceef2' : '#111'};height:100vh}
.titlebar{height:40px;display:flex;align-items:center;padding:0 18px;font-size:12px;color:#707784;border-bottom:1px solid #8883}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #8883}.harness-main{height:calc(100vh - 90px);overflow:auto;display:flex;flex-direction:column}.harness-chat{width:100%;max-width:1120px;margin:0 auto;flex:1;padding:16px 20px;box-sizing:border-box}.harness-composer{position:sticky;bottom:0;max-width:1080px;width:calc(100% - 32px);margin:0 auto;padding:8px 0 16px;background:${theme === 'dark' ? '#111317' : '#f5f6f8'}}
.harness-input{border:1px solid #8886;border-radius:12px;padding:12px;background:${theme === 'dark' ? '#1b1d22' : '#fff'}}.harness-input textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:70px;background:transparent;color:inherit;border:0;font:inherit;line-height:1.7;outline-offset:3px}.harness-tools{display:flex;align-items:center;justify-content:space-between}.harness-send{background:#4056d9;color:white;border:0;padding:8px 18px;border-radius:8px;cursor:pointer}.harness-label{font-size:12px;color:${theme === 'dark' ? '#b4b9c3' : '#596475'}}
${theme === 'dark' ? ':root{--dsw-alias-bg-base:#1b1d22;--dsw-alias-bg-layer-1:#22252b;--dsw-alias-bg-layer-2:#2a2e35;--dsw-alias-label-primary:#eceef2;--dsw-alias-label-secondary:#b4b9c3;--dsw-alias-label-tertiary:#9ca3af;--dsw-alias-border-l2:rgba(255,255,255,.09);--dsw-alias-border-l3:rgba(255,255,255,.15);--dsw-alias-interactive-bg-hover:rgba(255,255,255,.06);--dsw-alias-bg-mask-1:rgba(0,0,0,.5)}' : ''}</style>
<script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script></head><body>
<div class="titlebar">Client harness · sample data</div><header class="header"><b>Conversation</b><span id="btn"></span><span data-conversation-header-corner style="position:fixed;right:12px;top:5px;width:28px;height:28px"><button aria-label="宿主侧栏" style="width:28px;height:28px" onclick="window.__cornerClicks=(window.__cornerClicks??0)+1">☰</button></span></header><div id="hero-options"></div>
<main class="harness-main"><div id="chat" class="harness-chat"></div><div class="harness-composer"><div id="settings"></div><div class="harness-input"><label for="draft" class="harness-label">需求</label><textarea id="draft" aria-label="需求"></textarea><div class="harness-tools"><div id="mode"></div><button class="harness-send" id="send">发送</button></div><p id="notice" role="status"></p></div></div></main><div id="overlay"></div>
<script>
const runs = ${JSON.stringify(states[state] ?? [])};
const history = ${JSON.stringify(history)}, legacy = ${JSON.stringify(legacy)};
const templateRun = ${JSON.stringify({ ...base, state: 'judging', candidates: [A, B] })};
const models = [{ provider:'deepseek', providerName:'DeepSeek', id:'deepseek-chat', name:'DeepSeek V3' }, { provider:'deepseek', providerName:'DeepSeek', id:'deepseek-reasoner', name:'DeepSeek R1' }];
window.__requests = []; window.__commands = []; window.__edits = []; window.__commandAcks = [];
const realFetch = window.fetch;
window.fetch = async (url, init) => {
  const m = String(url).match(/agent-compare\\/api\\/(\\w+)/);
  if (!m) return realFetch(url, init);
  const body = JSON.parse(init.body ?? '{}'); window.__requests.push({ method:m[1], body });
  if (m[1] === ${JSON.stringify(error)}) return new Response(JSON.stringify({ok:false,error:'请求失败，请重试'}),{status:503});
  if (m[1] === 'preferences') return realFetch('/harness/preferences',init);
  let value = m[1] === 'list' ? {runs:[...runs,...${JSON.stringify(state === 'blank' || state === 'blank-history' ? [] : history)}],legacy,isolation:'own-root'}
    : m[1] === 'setup' ? {current:{provider:'deepseek',model:'deepseek-chat'},project:{path:'D:/Projects/demo-shop',supported:true},generationMinutes:30}
    : m[1] === 'models' ? {current:{provider:'deepseek',model:'deepseek-chat'},models}
    : m[1] === 'preflight' ? {ok:true,reasons:[],rehearsal:true}
    : m[1] === 'patch' ? {text:'diff --git a/src/App.tsx b/src/App.tsx\\n+<button>Clear</button>',sha256:'a'.repeat(64),truncated:false} : runs.find(r=>r.runId===body.runId) ?? runs[0] ?? null;
  const selected = runs.findIndex(r=>r.runId===body.runId);
  if (m[1] === 'choose' && selected >= 0) { runs[selected] = {...runs[selected],state:'revealed',choice:{pick:body.pick},candidates:runs[selected].candidates.map(c=>({...c,...${JSON.stringify(strat)}[c.label]}))}; value=runs[selected]; }
  if (m[1] === 'adopt' && selected >= 0) { runs[selected] = {...runs[selected],state:'adopted',adoption:{state:'adopted',mode:body.mode,message:'已采用'}}; value=runs[selected]; }
  return new Response(JSON.stringify({ok:true,value}),{headers:{'content-type':'application/json'}});
};
window.__ModuleLoader__ = {load:({factory})=>{
  const mod=factory(id=>{if(id==='react')return React;throw new Error('unexpected require '+id)}), regs={};
  const subscribers=new Set(); let claim;
  let input={draft:'',draftRev:0,phase:'plain',attachmentIds:[],occurrences:[{source:'file',ref:'src/App.tsx',clipboardText:'src/App.tsx'}]};
  const notify=()=>{for(const fn of subscribers)fn()};
  const draft=document.getElementById('draft');
  const shell={state:{getSnapshot:()=>input,subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)}},
    beginCommand:(next,span)=>{window.__edits.push({kind:'begin',span});if(span.draftRev!==input.draftRev)return false;claim=next;input={...input,claim:{name:next.name,token:next.token},draft:next.token+draft.value,phase:'claimed',draftRev:input.draftRev+1};notify();return true},
    focus:()=>draft.focus(),
    setDraft:()=>{throw new Error('whole-draft replacement is forbidden in this harness')},
  };
  const scope={get:n=>n==='conversation'?{input:{for:()=>shell}}:undefined,bail:(_scope,event,request)=>{
    if(event!=='slash/input-consume-token'||request.guard.span.draftRev!==input.draftRev)return false;
    window.__edits.push({kind:'consume',span:request.guard.span});claim=undefined;input={...input,claim:undefined,draft:draft.value,phase:'plain',draftRev:input.draftRev+1};notify();return true;
  }};
  window.__input=()=>input;
  draft.oninput=()=>{input={...input,draft:(claim?claim.token:'')+draft.value,draftRev:input.draftRev+1};notify()};
  const renderCommand=(result,args='')=>{const cv=regs['conversation.chat.commandview'];const host=document.createElement('div');document.getElementById('chat').appendChild(host);ReactDOM.createRoot(host).render(React.createElement(cv.C,{...cv.spec.inject('s1'),node:{name:'ab',args,outcome:result}}))};
  const remote={commands:{execute:async(sid,line,attachments)=>{
    window.__commands.push({sessionId:sid,line,attachments});
    if(${JSON.stringify(error==='command')})return{ok:false,error:{message:'请求失败，请重试'}};
    const request=JSON.parse(line.slice('/ab @ui '.length));
    if(request.preferences.mode==='cross-model'&&request.preferences.models.some(m=>!m.model))return{ok:true,value:{result:{kind:'error',text:'请选择两个模型'}}};
    const run={...templateRun,runId:(0x10000000+window.__commands.length).toString(16),task:request.task||'示例任务',origin:{kind:'command',id:'command-'+window.__commands.length}};runs.unshift(run);
    const result={kind:'success',text:'A|B 比较已开始 · 运行 '+run.runId};if(!${JSON.stringify(state==='blank'||state==='blank-history')})renderCommand(result,request.task);return{ok:true,value:{result}};
  }}};
  document.getElementById('send').onclick=async()=>{
    if(!claim){document.getElementById('notice').textContent='普通发送';return}
    input={...input,phase:'submitting'};notify();
    try{const outcome=await claim.submit(draft.value,scope,[]);if(outcome.kind==='success'){draft.value='';claim=undefined;input={...input,draft:'',claim:undefined,phase:'plain',draftRev:input.draftRev+1}}else{input={...input,phase:'claimed'};document.getElementById('notice').textContent=outcome.text} }
    catch(error){input={...input,phase:'claimed'};document.getElementById('notice').textContent=error.message}notify();
  };
  mod.apply({get:n=>n==='sessions'?{scope:()=>scope}:undefined,remote,events:{dispatch:()=>[(sessionId,name,result)=>window.__commandAcks.push({sessionId,name,result})]},slots:{inject:(n,cb)=>cb(),register:(spec,C)=>{regs[spec.name]={spec,C};return()=>{}}}});
  const blank=${JSON.stringify(state==='blank'||state==='blank-history')};
  const headerRoots={normal:ReactDOM.createRoot(document.getElementById('btn')),hero:ReactDOM.createRoot(document.getElementById('hero-options'))};
  window.__switchHeader=(sessionId,isBlank)=>{for(const [key,slot,visible]of [['normal','conversation.session.header.utilities',!isBlank],['hero','conversation.hero.options',isBlank]]){const item=regs[slot];headerRoots[key].render(visible?React.createElement(item.C,{...item.spec.inject(sessionId),key:sessionId}):null)}};
  window.__switchHeader('s1',blank);
  for(const [slot,id] of [['shell.overlay','overlay'],['conversation.input.left','mode'],['conversation.input.dock','settings']]){const item=regs[slot];ReactDOM.createRoot(document.getElementById(id)).render(React.createElement(item.C,{...item.spec.inject('s1'),session:{blank}}))}
  if(${JSON.stringify(state==='inline')}) renderCommand({kind:'success',text:'A|B 比较已开始 · 运行 0a1b2c3d'});
  else if(${JSON.stringify(!['start','closed','compose','blank','blank-history'].includes(state))}) setTimeout(()=>{
    document.querySelector('.ac-header-btn').focus();document.querySelector('.ac-header-btn').click();
    if(${JSON.stringify(state==='guide')})setTimeout(()=>[...document.querySelectorAll('.ac-tab')].at(-1).click(),100);
    else if(${JSON.stringify(state!=='history')})setTimeout(()=>document.querySelector('.ac-hrow')?.click(),200);
  },50);
}};
</script><script src="/lib/client.js"></script></body></html>`

const demo = (label) => `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:system-ui;padding:24px;background:#fff">
<h2 style="margin:0 0 12px">Demo Shop · ${label}</h2><input type="search" placeholder="搜索商品" style="padding:8px;border:1px solid #ccc;border-radius:6px;width:260px">
<div style="display:flex;gap:6px;margin-top:10px">${['Audio', 'Desk', 'Bags', 'Light'].map((c) => `<button aria-pressed="false">${c}</button>`).join('')}${label === 'A' ? '<button>清空</button>' : ''}</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:14px">${['Studio Headphones', 'Pocket Speaker', 'Monitor Stand', 'Desk Mat', 'Backpack', 'Desk Lamp'].map((n) => `<div style="border:1px solid #e3e6ea;border-radius:8px;padding:10px">${n}</div>`).join('')}</div>`

const vendor = { 'react.js': 'node_modules/react/umd/react.development.js', 'react-dom.js': 'node_modules/react-dom/umd/react-dom.development.js' }
export async function createUiHarness({ port = 4317, demoPort = 4318 } = {}) {
const preferencesHome = await mkdtemp(path.join(os.tmpdir(), 'agent-compare-ui-preferences-'))
const preferences = new PreferencesStore(new RunStore(preferencesHome))
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  try {
    if (u.pathname === '/harness/preferences') {
      let body = ''; for await (const chunk of req) body += chunk
      const input = JSON.parse(body)
      const value = input.value === undefined ? await preferences.load(input.sessionId) : await preferences.save(input.sessionId, input.value)
      res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: true, value }))
    }
    if (u.pathname === '/') return res.end(page(u.searchParams.get('state') ?? 'judging', u.searchParams.get('theme') ?? 'light', u.searchParams.get('error') ?? ''))
    if (u.pathname.startsWith('/vendor/')) return res.end(await readFile(path.join(root, vendor[u.pathname.slice(8)])))
    if (u.pathname === '/lib/client.js') return res.end(await readFile(path.join(root, 'lib/client.js')))
    res.statusCode = 404
    res.end()
  } catch (e) { res.statusCode = 500; res.end(String(e)) }
})
const demoServer = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(demo(req.url.includes('b') ? 'B' : 'A')) })
const listen = (s, p) => new Promise((resolve, reject) => { s.once('error', reject); s.listen(p, '127.0.0.1', resolve) })
await listen(demoServer, demoPort)
try { await listen(server, port) } catch (error) { await new Promise(r => demoServer.close(r)); throw error }
const demoBase = `http://127.0.0.1:${demoServer.address().port}`
for (const list of Object.values(states)) for (const run of list) for (const candidate of run.candidates) {
  if (candidate.previewUrl) candidate.previewUrl = `${demoBase}/${candidate.label.toLowerCase()}`
}
return { url: `http://127.0.0.1:${server.address().port}`, close: async () => { await Promise.all([server, demoServer].map(s => new Promise(r => { s.close(r); s.closeAllConnections() }))); if (path.dirname(preferencesHome) === path.resolve(os.tmpdir()) && path.basename(preferencesHome).startsWith('agent-compare-ui-preferences-')) await rm(preferencesHome, {recursive:true,force:true}) } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const harness = await createUiHarness()
  console.log(`preview (sample data): ${harness.url}/?state=start|history|running|judging|failed|revealed|blocked|adopted|recovery&theme=light|dark`)
}
