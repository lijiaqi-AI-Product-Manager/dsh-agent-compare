// Upgrade only Safari through Apple's system updater on a disposable CI runner.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'

assert.equal(process.platform,'darwin');assert.equal(process.env.GITHUB_ACTIONS,'true')
const readVersion=()=>execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString','/Applications/Safari.app/Contents/Info.plist'],{encoding:'utf8',timeout:10000}).trim()
const current=version=>{const match=/^(\d+)\.(\d+)(?:\.\d+)?$/.exec(version);return Boolean(match&&(Number(match[1])>27||(Number(match[1])===27&&Number(match[2])>=2)))}
const before=readVersion(),output=path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS??'.runtime-checks/safari-evidence')
await mkdir(output,{recursive:true})
let listing='',selected,after=before
try {
  if(!current(before)){
    listing=execFileSync('/usr/sbin/softwareupdate',['--list'],{encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024})
    const labels=[...listing.matchAll(/Label:\s*(Safari[\w.-]+)/g)].map(match=>match[1])
    selected=labels.find(label=>/^Safari27\.2[\w.-]*$/.test(label))
    assert.ok(selected,'The runner does not offer Safari 27.2; do not report its older bundled browser as current')
    execFileSync('/usr/bin/sudo',['-n','/usr/sbin/softwareupdate','--install',selected],{stdio:'inherit',timeout:600000})
    after=readVersion()
  }
  assert.ok(current(after),'Safari is still older than the current stable acceptance baseline')
  console.log(JSON.stringify({safariBefore:before,safariAfter:after,updated:Boolean(selected),source:'Apple system software update',systemRebootRequested:false}))
} finally {
  await writeFile(path.join(output,'safari-version-setup.json'),JSON.stringify({before,after,selected,offeredLabels:[...listing.matchAll(/Label:\s*([\w.-]+)/g)].map(match=>match[1]),baseline:'27.2',systemRebootRequested:false},null,2))
}
