import assert from 'node:assert/strict'
import {createServer,request as httpRequest} from 'node:http'
import {connect} from 'node:net'
import {readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {runProjectProcess} from '../lib/core/project-process.js'

/** Local-only transport fixtures; never change user or global configuration. */
export async function managerNetworkCheck(item,repo,prepare){
 const name='agent-compare-network-fixture',version='1.0.0'
 const entry={name,version,dist:{tarball:'http://registry.agent-compare.invalid/fixture.tgz',shasum:'0'.repeat(40)}}
 const manifest={name,version,'dist-tags':{latest:version},versions:{[version]:entry},time:{created:'2025-01-01T00:00:00.000Z',modified:'2025-01-01T00:00:00.000Z',[version]:'2025-01-01T00:00:00.000Z'}}
 let direct=0,proxied=0
 const sockets=new Set()
 const paths=[]
 const registry=createServer((req,res)=>{direct++;if(paths.length<32)paths.push(req.url);res.setHeader('content-type','application/json');res.end(JSON.stringify(/\/(latest|1\.0\.0)$/.test(req.url)?entry:manifest))})
 const proxy=createServer((req,res)=>{
  let target;try{target=new URL(req.url)}catch{res.writeHead(400);res.end();return}
  if(target.hostname!=='registry.agent-compare.invalid'){res.writeHead(403);res.end();return}
  proxied++
  const upstream=httpRequest({host:'127.0.0.1',port:registry.address().port,path:target.pathname+target.search,method:req.method},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)})
  upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
 })
 proxy.on('connect',(req,socket,head)=>{
  if(req.url!=='registry.agent-compare.invalid:80'){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return}
  proxied++
  const upstream=connect(registry.address().port,'127.0.0.1',()=>{socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket)})
  upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy())
 })
 for(const server of[registry,proxy])server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket))})
 const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 await listen(registry);await listen(proxy)
 const configuration=path.join(repo,item.linker?'.yarnrc.yml':'.npmrc'),original=await readFile(configuration,'utf8')
 const configure=async(target,proxyUrl)=>{
  if(item.linker){
   await writeFile(configuration,original.replace(/^npmRegistryServer:.*$/m,'npmRegistryServer: "'+target+'"')+'\nunsafeHttpWhitelist:\n  - "127.0.0.1"\n  - "registry.agent-compare.invalid"\n'+(proxyUrl?'httpProxy: "'+proxyUrl+'"\nhttpsProxy: "'+proxyUrl+'"\n':''))
  }else await writeFile(configuration,'registry='+target+'\n')
 }
 const base={CI:'1',HTTP_PROXY:undefined,HTTPS_PROXY:undefined,ALL_PROXY:undefined,NO_PROXY:undefined,http_proxy:undefined,https_proxy:undefined,all_proxy:undefined,no_proxy:undefined,npm_config_registry:undefined,npm_config_proxy:undefined,npm_config_https_proxy:undefined,YARN_NPM_REGISTRY_SERVER:undefined,YARN_HTTP_PROXY:undefined,YARN_HTTPS_PROXY:undefined}
 const argv=item.manager==='yarn'?(item.linker?['yarn','npm','info',name,'--fields','version','--json']:['yarn','info',name,'version','--json']):[item.manager,'view',name,'version','--json']
 const query=async env=>{
  const result=await runProjectProcess(argv,{cwd:repo,timeoutMs:25000,env:{...base,...env}},prepare)
  assert.equal(result.code,0,item.id+' registry fixture '+JSON.stringify(paths)+': '+result.stderr+'\n'+result.stdout)
  assert.ok(result.stdout.includes(version))
 }
 try{
  await configure('http://127.0.0.1:'+registry.address().port+'/')
  await query({NO_PROXY:'127.0.0.1',no_proxy:'127.0.0.1'})
  assert.ok(direct>0,'project registry configuration was ignored')
  const proxyUrl='http://127.0.0.1:'+proxy.address().port
  await configure('http://registry.agent-compare.invalid/',item.linker?proxyUrl:undefined)
  await query({HTTP_PROXY:proxyUrl,HTTPS_PROXY:proxyUrl,http_proxy:proxyUrl,https_proxy:proxyUrl,NO_PROXY:'',no_proxy:''})
  assert.ok(proxied>0,'configured proxy was ignored')
  if(!item.linker){
   const before=proxied
   await configure('http://127.0.0.1:'+registry.address().port+'/')
   await query({HTTP_PROXY:proxyUrl,HTTPS_PROXY:proxyUrl,http_proxy:proxyUrl,https_proxy:proxyUrl,NO_PROXY:'127.0.0.1',no_proxy:'127.0.0.1'})
   assert.equal(proxied,before,'NO_PROXY did not bypass the configured proxy')
  }
  return{projectRegistry:true,proxy:true,noProxy:item.linker?'uses Yarn networkSettings; not claimed from NO_PROXY':true}
 }finally{
  await writeFile(configuration,original)
  for(const socket of sockets)socket.destroy()
  await Promise.all([registry,proxy].map(server=>new Promise(resolve=>server.close(resolve))))
 }
}
