// Disposable macOS CI only. Exercise the product journal and validated system
// payload with the runner's explicit administrator grant, without a login dialog.
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {PreviewNetwork,previewAliasCommand} from '../lib/host/preview-network.js'
import {RunStore} from '../lib/core/run-store.js'

assert.equal(process.platform,'darwin');assert.equal(process.env.GITHUB_ACTIONS,'true')
const mode=process.argv[2]
assert.ok(['runtime','safari','ui'].includes(mode))
const output=path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS??'.runtime-checks/browser-evidence')
await mkdir(output,{recursive:true})
const home=await mkdtemp(path.join(output,'network-state-')),store=new RunStore(home)
const inventory=()=>new Set([...execFileSync('/sbin/ifconfig',['lo0'],{encoding:'utf8',timeout:10000}).matchAll(/^\s*inet\s+([\d.]+)\s/gm)].map(match=>match[1]))
const before=inventory(),created=new Set()
const system={
 addresses:async()=>inventory(),
 provision:async addresses=>{
  assert.ok(addresses.every(address=>!before.has(address)))
  const stdout=execFileSync('/usr/bin/sudo',['-n','/bin/sh','-c',previewAliasCommand(addresses)],{encoding:'utf8',timeout:30000,maxBuffer:65536})
  for(const line of stdout.split(/[\r\n]+/)){const match=/^created:(127\.[\d.]+)$/.exec(line.trim());if(match&&addresses.includes(match[1]))created.add(match[1])}
  return stdout
 },
}
const network=new PreviewNetwork(store,system)
const run=script=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[script],{stdio:'inherit',env:{...process.env,AGENT_COMPARE_UI_PREVIEW_HOSTS:hosts.join(','),AGENT_COMPARE_RUNTIME_PREVIEW_HOSTS:hosts.join(',')}})
 child.once('error',reject);child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`${script} exited ${code??signal}`)))
})
const hosts=[],started=performance.now()
let setupStatus,afterRelease,setupMs
try {
 assert.equal((await network.status()).state,'needs-setup')
 setupStatus=await network.enable(true);setupMs=performance.now()-started
 assert.equal(setupStatus.available,64);assert.equal(created.size,64)
 const signal=new AbortController().signal
 for(const label of ['A','B'])hosts.push(await network.allocate({runId:'f00dbeef',label},signal))
 assert.equal(new Set(hosts).size,2)
 const restored=new PreviewNetwork(new RunStore(home),system)
 assert.equal((await restored.status()).available,62)
 assert.ok(!hosts.includes(await restored.allocate({runId:'f00dbeef',label:'R'},signal)))
 await run('scripts/test-numeric-preview.mjs')
 for(const script of mode==='runtime'?['scripts/test-runtime.mjs']:mode==='safari'?['scripts/test-safari.mjs']:['scripts/test-safari-setup.mjs','scripts/test-ui.mjs','scripts/test-locales.mjs','scripts/test-preview-origins.mjs'])await run(script)
} finally {
 const ledger=JSON.parse(await readFile(path.join(home,'preview-network.json'),'utf8').catch(()=>'{}'))
 const confirmed=new Set((ledger.entries??[]).filter(entry=>entry.state==='configured').map(entry=>entry.address))
 for(const address of created){
  assert.ok(!before.has(address)&&confirmed.has(address),'Do not remove an unconfirmed or preexisting system address')
  execFileSync('/usr/bin/sudo',['-n','/sbin/ifconfig','lo0','-alias',address],{timeout:5000})
 }
 const after=inventory();assert.ok([...before].every(address=>after.has(address)))
 assert.ok([...created].every(address=>!after.has(address)))
 afterRelease=await network.status()
 await writeFile(path.join(output,'preview-network-system.json'),JSON.stringify({scenario:'product address journal and validated payload under an explicit disposable CI grant',platform:process.platform,mode,setupMs,setupStatus,confirmedCreated:created.size,preexistingAddressesPreserved:true,ownedAddressesRemoved:true,afterRelease,administratorDialogAutomated:false,recordsRetained:true},null,2))
}
assert.equal(afterRelease.state,'needs-setup')
await assert.rejects(network.allocate({runId:'f00dbeef',label:'A'},new AbortController().signal))
console.log(JSON.stringify({productPreviewNetwork:true,mode,setupMs,configured:setupStatus.configured,distinctAddresses:true,recreatedStorePassed:true,explicitReleaseDetected:true,preexistingAddressesPreserved:true,administratorDialogAutomated:false}))
