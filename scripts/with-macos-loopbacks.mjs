// Disposable CI feasibility: never change a maintainer's network configuration.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
assert.equal(process.platform, 'darwin'); assert.equal(process.env.GITHUB_ACTIONS, 'true')
const mode = process.argv[2]
assert.ok(mode === 'ui' || mode === 'safari')
const hosts = ['127.87.44.19','127.87.44.20'], added = []
const before = execFileSync('/sbin/ifconfig',['lo0'],{encoding:'utf8'})
assert.ok(hosts.every(host=>!before.split(/\s+/).includes(host)), 'A requested test address already exists; leave it untouched')
const run = script => new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[script],{stdio:'inherit',env:{...process.env,AGENT_COMPARE_UI_PREVIEW_HOSTS:hosts.join(',')}})
 child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error(script+' exited '+code)))
})
try {
 for(const host of hosts){execFileSync('/usr/bin/sudo',['-n','/sbin/ifconfig','lo0','alias',host,'255.255.255.255']);added.push(host)}
 for(const script of mode==='ui'?['scripts/test-ui.mjs','scripts/test-locales.mjs','scripts/test-preview-origins.mjs']:['scripts/test-safari.mjs'])await run(script)
} finally {
 for(const host of added.reverse())execFileSync('/usr/bin/sudo',['-n','/sbin/ifconfig','lo0','-alias',host])
}
