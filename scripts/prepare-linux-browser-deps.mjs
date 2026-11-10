// Configure the disposable CI machine, preserving the distribution's signed
// repositories and package versions. Never run as part of plugin installation.
import assert from 'node:assert/strict'
import {lstat,readFile,writeFile} from 'node:fs/promises'
import {configureUbuntuBrowserSources} from './ubuntu-browser-sources.mjs'
assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.getuid(),0)
const {changedSourceFiles}=await configureUbuntuBrowserSources({lstat,readFile,writeFile})
await writeFile('/etc/apt/apt.conf.d/99agentcompare-browser-network','Acquire::Retries "2";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDpkg::Use-Pty "0";\n')
console.log(JSON.stringify({officialUbuntuHttpsMirror:true,changedSourceFiles,signaturePolicyChanged:false,downloadRetries:2,connectionTimeoutSeconds:30}))
