// Configure the disposable CI machine, preserving the distribution's signed
// repositories and package versions. Never run as part of plugin installation.
import assert from 'node:assert/strict'
import {lstat,readFile,writeFile} from 'node:fs/promises'
import {configureUbuntuBrowserSources,selectUbuntuBrowserMirror} from './ubuntu-browser-sources.mjs'
assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.getuid(),0)
const release=await readFile('/etc/os-release','utf8')
const codename=/^VERSION_CODENAME="?([a-z][a-z0-9-]*)"?$/m.exec(release)?.[1]
assert.ok(codename,'Ubuntu release codename is unavailable')
const selected=await selectUbuntuBrowserMirror({codename})
const {changedSourceFiles}=await configureUbuntuBrowserSources({lstat,readFile,writeFile},selected.mirror)
await writeFile('/etc/apt/apt.conf.d/99agentcompare-browser-network','Acquire::Retries "2";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDpkg::Use-Pty "0";\n')
console.log(JSON.stringify({signedUbuntuHttpsMirror:true,selectedMirror:selected.mirror,probeMode:'sequential-first-success',probes:selected.probes,probeTimeoutMs:selected.timeoutMs,changedSourceFiles,signaturePolicyChanged:false,downloadRetries:2,connectionTimeoutSeconds:30}))
