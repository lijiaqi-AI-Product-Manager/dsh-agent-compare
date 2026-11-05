// Real package managers and native project confinement, with controlled edits.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {Comparer,RunStore,createExampleRepo} from '../lib/core/index.js'
import {git} from '../lib/core/git.js'
import {defaultChecks,inspectProject,installArgv} from '../lib/core/project.js'
import {runOk} from '../lib/core/proc.js'
import {runProjectProcess} from '../lib/core/project-process.js'
import {runCommandChecks} from '../lib/core/checks.js'
import {createProjectProcess} from '../lib/host/project-process.js'
import {managerNetworkCheck} from './manager-network.mjs'

const runtime=path.resolve(process.env.AGENT_COMPARE_DSH_RUNTIME??'.runtime-checks/host-sdk')
const resolveRuntime=createRequire(path.join(runtime,'package.json'))
const load=name=>import(pathToFileURL(resolveRuntime.resolve(name)).href)
const {Context}=await load('@deepseek-ai/cordis')
const {LocalSandboxProvider}=await load('@deepseek-ai/dsh-sandbox-local')
const {scrubbedParentEnv}=await load('@deepseek-ai/dsh-subprocess')
const host=JSON.parse(await readFile(resolveRuntime.resolve('@deepseek-ai/dsh/package.json'),'utf8')).version
const root=process.env.AGENT_COMPARE_MANAGER_WORK?path.resolve(process.env.AGENT_COMPARE_MANAGER_WORK):await mkdtemp(path.join(path.dirname(process.cwd()),'.agent-compare-managers-'))
for(let ancestor=path.dirname(root);;ancestor=path.dirname(ancestor)){
 assert.equal(existsSync(path.join(ancestor,'node_modules')),false,'Manager fixtures must not inherit an ancestor node_modules; select a separate AGENT_COMPARE_MANAGER_WORK')
 if(path.dirname(ancestor)===ancestor)break
}
const tools=path.resolve(process.env.AGENT_COMPARE_PM_TOOLS??'.runtime-checks/manager-tools')
await mkdir(root,{recursive:true});await mkdir(tools,{recursive:true})
const originalPath=process.env.PATH, npmCommand=process.platform==='win32'?'npm.cmd':'npm'
let bootstrap=[npmCommand]
for(const [name,dependency,version] of [['npm','npm','12.2.2'],['pnpm','pnpm','12.16.1'],['yarn1','yarn','1.22.22'],['yarn4','@yarnpkg/cli-dist','4.18.1']]){
 const directory=path.join(tools,name);await mkdir(directory,{recursive:true})
 if(process.env.AGENT_COMPARE_PM_TOOLS)continue
 await writeFile(path.join(directory,'package.json'),JSON.stringify({private:true,dependencies:{[dependency]:version},...(name==='pnpm'?{allowScripts:{'pnpm@12.16.1':true}}:{})}))
 await runOk([...bootstrap,'install','--prefix',directory,'--no-audit','--no-fund',...(name==='pnpm'?[]:['--ignore-scripts'])],{cwd:directory,timeoutMs:300000,maxOutput:100000})
 if(name==='npm')bootstrap=[process.execPath,path.join(directory,'node_modules/npm/bin/npm-cli.js')]
}

const ctx=new Context(),fiber=ctx.plugin(LocalSandboxProvider,{})
await fiber
const prepare=createProjectProcess(()=>ctx.get('sandbox'),async()=>scrubbedParentEnv(),process.platform==='win32'?resolveRuntime.resolve('@deepseek-ai/dsh-win32-process'):undefined)
const cases=[
 {id:'npm',manager:'npm',version:'12.2.2'},
 {id:'pnpm',manager:'pnpm',version:'12.16.1',tool:'pnpm'},
 {id:'yarn-classic',manager:'yarn',version:'1.22.22',tool:'yarn1'},
 {id:'yarn-node-modules',manager:'yarn',version:'4.18.1',tool:'yarn4',linker:'node-modules'},
 {id:'yarn-pnp',manager:'yarn',version:'4.18.1',tool:'yarn4',linker:'pnp'},
].filter(item=>!process.env.AGENT_COMPARE_PM_CASE||item.id===process.env.AGENT_COMPARE_PM_CASE)
assert.ok(cases.length,'No matching manager case')
const results=[]
await writeFile(path.join(root,'results.json'),JSON.stringify({complete:false,expected:cases.map(item=>item.id),results},null,2))
try{
 for(const item of cases){
  console.log(item.id+': preparing native fixture')
  const npmPath=path.join(tools,'npm','node_modules','.bin')+path.delimiter+originalPath
  process.env.PATH=item.tool?path.join(tools,item.tool,'node_modules','.bin')+path.delimiter+npmPath:npmPath
  const directory=path.join(root,item.id);await mkdir(directory,{recursive:true})
  const repo=await createExampleRepo(path.join(directory,'projects'))
  const pkg=JSON.parse(await readFile(path.join(repo,'package.json'),'utf8'))
  pkg.packageManager=item.manager+'@'+item.version
  pkg.allowScripts={esbuild:true}
  await writeFile(path.join(repo,'package.json'),JSON.stringify(pkg,null,2)+'\n')
  await writeFile(path.join(repo,'.gitignore'),'node_modules/\ndist/\n.vite/\n')
  await writeFile(path.join(repo,'.npmrc'),'registry=https://registry.npmjs.org/\n')
  if(item.manager!=='npm')await rm(path.join(repo,'package-lock.json'))
  if(item.manager!=='npm')await writeFile(path.join(repo,item.manager==='pnpm'?'pnpm-lock.yaml':'yarn.lock'),await readFile(new URL('../test/managers/'+(item.manager==='pnpm'?'pnpm-lock.yaml':item.linker?'yarn-modern.lock':'yarn-classic.lock'),import.meta.url)))
  if(item.manager==='pnpm')await writeFile(path.join(repo,'pnpm-workspace.yaml'),'allowBuilds:\n  esbuild: true\n')
  if(item.linker)await writeFile(path.join(repo,'.yarnrc.yml'),'nodeLinker: '+item.linker+'\nnpmRegistryServer: "https://registry.npmjs.org"\n')
  const setup=await runProjectProcess(installArgv(await inspectProject(repo)).argv,{cwd:repo,timeoutMs:600000,env:{CI:'1'}},prepare)
  const lockBlocked=process.platform==='win32'&&item.id==='pnpm'
  if(lockBlocked)assert.match(setup.stderr+'\n'+setup.stdout,/ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK/,'Native pnpm changed: revisit the Windows guard instead of silently accepting it')
  else if(setup.code!==0)throw new Error(item.id+' fixture installation failed (timeout='+setup.timedOut+'): '+setup.stderr+'\n'+setup.stdout)
  const info=await inspectProject(repo)
  assert.equal(info.kind,'vite',info.reason)
  assert.equal(info.packageManager,item.manager)
  assert.equal(installArgv(info).frozen,true)
  await git(repo,['add','-A']);await git(repo,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Manager fixture'])
  const before=await readFile(path.join(repo,'src','App.tsx'))
  const loader=item.linker==='pnp'?await readFile(path.join(repo,'.pnp.cjs')):undefined
  const baselineType=item.linker==='pnp'?(await runCommandChecks(repo,{commands:defaultChecks(info).commands.filter(command=>command.name==='typecheck')},undefined,prepare))[0]:undefined
  if(baselineType)console.log(JSON.stringify({case:item.id,baselineType}))
  const managerScript=`process.stdout.write(JSON.stringify({proxy:process.env.HTTP_PROXY,registry:process.env.npm_config_registry,secret:process.env.AGENT_COMPARE_TEST_TOKEN}))`
  const saved={HTTP_PROXY:process.env.HTTP_PROXY,npm_config_registry:process.env.npm_config_registry,AGENT_COMPARE_TEST_TOKEN:process.env.AGENT_COMPARE_TEST_TOKEN}
  try{
   process.env.HTTP_PROXY='http://127.0.0.1:9';process.env.npm_config_registry='https://registry.example.invalid/';process.env.AGENT_COMPARE_TEST_TOKEN='not-forwarded'
   const canonical=scrubbedParentEnv()
   const probe=await runProjectProcess(['node','-e',managerScript],{cwd:repo,timeoutMs:30000},prepare)
   assert.equal(probe.code,0)
   const actual=JSON.parse(probe.stdout);assert.equal(actual.proxy,canonical.HTTP_PROXY);assert.equal(actual.registry,canonical.npm_config_registry);assert.equal(actual.secret,undefined)
  }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value}
  const store=new RunStore(path.join(directory,'state'))
  const transport=lockBlocked?undefined:await managerNetworkCheck(item,repo,prepare)
  let runnerCalls=0
  const comparer=new Comparer({store,version:'manager-check',prepareProjectProcess:prepare,runner:{isolation:'own-root',async run(request){
   runnerCalls++
   await writeFile(path.join(request.cwd,'src','App.tsx'),application(request.label))
   return{stopReason:'completed',usage:{kind:'unknown',reason:'controlled edit; no model request'}}
  }}})
  try{
   const start=await comparer.start({repo,task:'Search, category filters and clear; preserve the shared behavior contract.'})
   console.log(item.id+': comparison '+start.runId)
   const record=await comparer.wait(start.runId)
   if(lockBlocked){
    assert.equal(runnerCalls,0)
    assert.ok(record.candidates.every(candidate=>candidate.error?.stage==='preparing'&&candidate.error.message.includes('存储锁')))
    const result={case:item.id,host,version:item.version,platform:process.platform,supported:false,preGenerationBlocked:true,noModelRequests:true,code:'ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK',environmentContract:true}
    results.push(result);console.log(JSON.stringify(result));await comparer.cleanup(record.runId);continue
   }
   if(item.linker==='pnp'&&baselineType?.outcome==='failed'&&baselineType.tail.includes('TS2688')){
    assert.equal(runnerCalls,2)
    for(const candidate of record.candidates){
     assert.equal(candidate.install?.outcome,'passed');assert.equal(candidate.install.frozen,true)
     assert.equal(candidate.checks.find(check=>check.name==='typecheck').outcome,'failed')
     assert.match(candidate.checks.find(check=>check.name==='typecheck').tail,/TS2688/)
     assert.equal(candidate.checks.find(check=>check.name==='build').outcome,'passed')
     assert.equal(candidate.checks.find(check=>check.name==='browser').outcome,'passed')
     assert.equal(candidate.verdict.eligible,false)
    }
    await comparer.choose(record.runId,'B')
    await assert.rejects(comparer.adopt(record.runId,'worktree'),/没有通过共同验收/)
    assert.ok(before.equals(await readFile(path.join(repo,'src','App.tsx'))))
    assert.ok(loader.equals(await readFile(path.join(repo,'.pnp.cjs'))))
    const result={case:item.id,host,version:item.version,platform:process.platform,supported:false,frozen:true,buildAndBrowser:true,baselineTypecheck:'TS2688',adoptionRejected:true,loaderPreserved:true,environmentContract:true,transport}
    results.push(result);console.log(JSON.stringify(result));await comparer.cleanup(record.runId);continue
   }
   assert.ok(record.candidates.every(candidate=>candidate.verdict?.eligible),JSON.stringify({case:item.id,baselineType,candidates:record.candidates.map(candidate=>({label:candidate.label,stage:candidate.stage,error:candidate.error,verdict:candidate.verdict,checks:candidate.checks}))}))
   for(const candidate of record.candidates){assert.equal(candidate.install.frozen,true);assert.equal(candidate.install.runtime.packageManagerVersion,item.version);assert.equal(candidate.checks.find(check=>check.name==='browser').outcome,'passed')}
   assert.equal(new Set(record.candidates.map(candidate=>new URL(candidate.preview.url).origin)).size,2)
   await comparer.choose(record.runId,'B')
   console.log(item.id+': reviewed adoption')
   const adopted=await comparer.adopt(record.runId,'worktree')
   assert.equal(adopted.adoption.state,'adopted')
   const checks=await runCommandChecks(repo,record.acceptance.checks,undefined,prepare)
   assert.ok(checks.every(check=>check.outcome==='passed'),JSON.stringify(checks))
   if(loader)assert.ok(loader.equals(await readFile(path.join(repo,'.pnp.cjs'))),'adoption changed the original project loader')
   assert.ok((await readFile(path.join(repo,'src','App.tsx'),'utf8')).includes('Version B'))
   const undone=await comparer.revert(record.runId);assert.equal(undone.adoption.state,'reverted')
   assert.ok(before.equals(await readFile(path.join(repo,'src','App.tsx'))))
   if(loader)assert.ok(loader.equals(await readFile(path.join(repo,'.pnp.cjs'))))
   const result={case:item.id,host,manager:item.manager,version:item.version,platform:process.platform,frozen:true,sharedBehavior:true,isolatedOrigins:true,adopted:true,adoptedChecks:true,undone:true,loaderPreserved:!!loader,environmentContract:true,transport}
   results.push(result);console.log(JSON.stringify(result))
  }finally{await comparer.dispose()}
 }
 await writeFile(path.join(root,'results.json'),JSON.stringify({complete:true,expected:cases.map(item=>item.id),results},null,2))
}finally{process.env.PATH=originalPath;await fiber.dispose()}

function application(label){return `import {useState} from 'react'
import {products} from './products'
export function App(){const[q,setQ]=useState(''),[cat,setCat]=useState('');return <main><h1>Version ${label}</h1><input type="search" aria-label="搜索商品" value={q} onChange={e=>setQ(e.target.value)}/><div>{['Audio','Desk','Bags','Light'].map(c=><button key={c} aria-pressed={cat===c} onClick={()=>setCat(cat===c?'':c)}>{c}</button>)}</div><button onClick={()=>{setQ('');setCat('')}}>清空</button>{products.filter(p=>(!cat||p.category===cat)&&p.name.toLowerCase().includes(q.toLowerCase())).map(p=><article key={p.id} data-testid="product-card">{p.name}</article>)}</main>}
`}
