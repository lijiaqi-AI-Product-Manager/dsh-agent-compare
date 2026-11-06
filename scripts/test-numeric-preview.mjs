// Process/address transport acceptance with a labeled HTTP fixture, not a model run.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startVitePreview } from '../lib/core/preview.js'
import { fetchPreview, isNumericPreviewHost } from '../lib/core/preview-url.js'

const hosts=(process.env.AGENT_COMPARE_UI_PREVIEW_HOSTS??'').split(',')
assert.equal(hosts.length,2)
assert.equal(new Set(hosts).size,2)
assert.ok(hosts.every(isNumericPreviewHost))
const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'agent-compare-numeric-')))
const previews=[]
const prepare=async request=>({argv:request.argv,env:{PATH:process.env.PATH}})
try {
  for(const host of hosts){
    const directory=path.join(root,host),bin=path.join(directory,'node_modules/vite/bin')
    await mkdir(bin,{recursive:true})
    await writeFile(path.join(directory,'package.json'),JSON.stringify({private:true,devDependencies:{vite:'0.0.0-fixture'}}))
    await writeFile(path.join(bin,'vite.js'),`const http=require('node:http');const a=process.argv;const host=a[a.indexOf('--host')+1],port=Number(a[a.indexOf('--port')+1]);http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({binding:host,host:req.headers.host,path:req.url}))}).listen(port,host,()=>console.log('Local: http://'+host+':'+port+'/base/?v=1'))`)
    previews.push(await startVitePreview(directory,{loopbackHost:host,prepareProjectProcess:prepare,timeoutMs:15000}))
  }
  for(let index=0;index<previews.length;index++){
    const preview=previews[index],url=new URL(preview.url)
    assert.equal(url.hostname,hosts[index]);assert.equal(url.pathname,'/base/')
    const response=await fetchPreview(preview.url)
    assert.equal(response.status,200)
    assert.deepEqual(await response.json(),{binding:hosts[index],host:url.host,path:'/base/?v=1'})
    for(const control of ['127.0.0.1',hosts[1-index]]){
      await assert.rejects(fetchPreview(`http://${control}:${preview.port}/`,{signal:AbortSignal.timeout(1500)}))
    }
  }
  await previews[0].stop()
  await assert.rejects(fetchPreview(previews[0].url,{signal:AbortSignal.timeout(1500)}))
  assert.equal((await fetchPreview(previews[1].url)).status,200)
  const result={scenario:'core preview transport with explicit preconfigured loopback addresses and labeled HTTP fixtures',platform:process.platform,node:process.version,bindExactAddress:true,preserveEntryPath:true,probeActualOrigin:true,otherLoopbackAddressesRefused:true,stopOnePreservesOther:true,doesNotConfigureNetwork:true}
  const output=process.env.AGENT_COMPARE_UI_ARTIFACTS??'.runtime-checks/browser-evidence'
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'numeric-preview-transport.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
} finally {await Promise.all(previews.map(preview=>preview.stop()))}
