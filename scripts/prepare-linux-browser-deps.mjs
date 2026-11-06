// Configure the disposable CI machine, preserving the distribution's signed
// repositories and package versions. Never run as part of plugin installation.
import assert from 'node:assert/strict'
import {lstat,readFile,writeFile} from 'node:fs/promises'
assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.getuid(),0)
let changed=0
for(const file of ['/etc/apt/sources.list.d/ubuntu.sources','/etc/apt/sources.list']){
  let info
  try{info=await lstat(file)}catch(error){if(error.code==='ENOENT')continue;throw error}
  assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<1024*1024)
  const before=await readFile(file,'utf8'),after=before.replace(/https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu(?=\/|\s|$)/g,'https://archive.ubuntu.com/ubuntu')
  if(after!==before){await writeFile(file,after);changed++}
}
await writeFile('/etc/apt/apt.conf.d/99agentcompare-browser-network','Acquire::Retries "2";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDpkg::Use-Pty "0";\n')
console.log(JSON.stringify({officialUbuntuHttpsMirror:true,changedSourceFiles:changed,signaturePolicyChanged:false,downloadRetries:2,connectionTimeoutSeconds:30}))
