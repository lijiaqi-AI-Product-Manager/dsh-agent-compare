// A hosted disposable runner is the ownership boundary here. Never close an
// existing browser on a maintainer's own machine or a self-hosted runner.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {realpath} from 'node:fs/promises'
import {launchHostedSafari} from './native-safari-launch.mjs'

export async function prepareNativeSafariSession(){
  if(process.env.GITHUB_ACTIONS!=='true')return {disposableCi:false,existingBrowsersPreserved:true,closed:[]}
  assert.equal(process.platform,'darwin')
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Existing browsers may only be closed on a disposable hosted runner')
  const logical='/Applications/Safari.app/Contents/MacOS/Safari',allowed=new Set([logical,await realpath(logical)])
  let ids=[]
  try {ids=execFileSync('/usr/bin/pgrep',['-x','Safari'],{encoding:'utf8',timeout:5000}).trim().split(/\s+/).map(Number)}
  catch(error){if(error.status!==1)throw error}
  const identity=pid=>{
    try{return execFileSync('/bin/ps',['-ww','-p',String(pid),'-o','uid=,lstart=,comm='],{encoding:'utf8',timeout:5000}).trim()}
    catch(error){if(error.status===1)return undefined;throw error}
  }
  const closed=[]
  for(const pid of ids){
    assert.ok(Number.isSafeInteger(pid)&&pid>1)
    const observed=identity(pid)
    if(!observed)continue
    assert.equal(Number(/^\s*(\d+)/.exec(observed)?.[1]),process.getuid(),'Do not close a browser owned by another user')
    assert.ok([...allowed].some(file=>observed.endsWith(' '+file)),'The process is not the installed stable Safari application')
    assert.equal(identity(pid),observed,'Browser identity changed before termination')
    execFileSync('/bin/kill',['-TERM',String(pid)],{timeout:5000})
    const deadline=Date.now()+5000
    while(identity(pid)===observed&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100))
    assert.notEqual(identity(pid),observed,'The existing CI browser did not exit; do not force it')
    closed.push({pid,verifiedCurrentUser:true,verifiedApplication:true,birthIdentityChecked:true})
  }
  // Keep a normally initialized, authorized browser alive while WebDriver
  // creates its separate automation window; do not race a second cold launch.
  launchHostedSafari()
  return {disposableCi:true,closed,normalLaunchBeforeSession:true,otherApplicationsTouched:false,permanentSettingsChanged:false}
}
