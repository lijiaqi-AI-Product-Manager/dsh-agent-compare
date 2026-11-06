// WebKit uses a Safari-shaped user agent on every OS. Numeric fixture origins
// exercise its production admission rule; only macOS needs explicit CI aliases.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
const engine=process.env.AGENT_COMPARE_UI_BROWSER_ENGINE
assert.ok(['firefox','webkit'].includes(engine))
const env={...process.env}
if(engine==='webkit'&&process.platform!=='darwin')env.AGENT_COMPARE_UI_PREVIEW_HOSTS='127.87.44.19,127.87.44.20'
const run=script=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,script,{stdio:'inherit',env})
  child.once('error',reject)
  child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`${script[0]} exited ${code??signal}`)))
})
if(engine==='webkit'&&process.platform==='darwin')await run(['scripts/with-preview-network.mjs','ui'])
else {
  if(engine==='webkit')await run(['scripts/test-safari-setup.mjs'])
  for(const script of ['scripts/test-ui.mjs','scripts/test-locales.mjs','scripts/test-preview-origins.mjs'])await run([script])
}
