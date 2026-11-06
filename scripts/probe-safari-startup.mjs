// Isolate browser initialization from every product, model and address change.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { prepareNativeSafariSession } from './prepare-native-safari-session.mjs'

assert.equal(process.platform, 'darwin')
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
const output=path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS??'.runtime-checks/safari-evidence')
await mkdir(output,{recursive:true})
await prepareNativeSafariSession()
const port=await new Promise((resolve,reject)=>{
  const server=createServer();server.once('error',reject)
  server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(()=>resolve(address.port))})
})
const driver=spawn('/usr/bin/safaridriver',['--port',String(port)],{stdio:['ignore','pipe','pipe']})
let session,driverError
driver.once('error',error=>{driverError=error})
// Drain without publishing unrelated process output.
driver.stdout.resume();driver.stderr.resume()
const report={scenario:'native browser startup before product setup',macOS:execFileSync('/usr/bin/sw_vers',['-productVersion'],{encoding:'utf8',timeout:10000}).trim(),kernel:os.release(),architecture:process.arch,
  safari:execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString','/Applications/Safari.app/Contents/Info.plist'],{encoding:'utf8',timeout:10000}).trim(),
  driver:execFileSync('/usr/bin/safaridriver',['--version'],{encoding:'utf8',timeout:10000}).trim(),productLoaded:false,projectStarted:false,previewAddressesConfigured:false,modelCalled:false}
const request=async(method,route,body)=>{
  const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)})
  const result=await response.json()
  if(!response.ok||result.value?.error)throw new Error(`${method} ${route}: ${result.value?.error??response.status} ${result.value?.message??''}`)
  return result.value
}
try{
  const deadline=Date.now()+10000
  while(true){
    if(driverError)throw driverError
    try{if((await request('GET','/status')).ready)break}catch(error){if(Date.now()>=deadline)throw error}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const created=await request('POST','/session',{capabilities:{alwaysMatch:{browserName:'safari'}}})
  session=created.sessionId;assert.ok(session)
  report.sessionCreated=true;report.driverReportedBrowser=created.capabilities?.browserVersion
}catch(error){report.sessionCreated=false;report.failure=error.message;throw error}
finally{
  if(session)await request('DELETE','/session/'+session).catch(()=>{})
  if(driver.exitCode===null&&driver.signalCode===null){driver.kill('SIGTERM');await Promise.race([new Promise(resolve=>driver.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(driver.exitCode===null&&driver.signalCode===null)driver.kill('SIGKILL')}
  await writeFile(path.join(output,'before-product-safari-startup.json'),JSON.stringify(report,null,2))
}
console.log(JSON.stringify(report))
