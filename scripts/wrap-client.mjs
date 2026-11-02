// Wrap the CommonJS client build in the DSH web client loader contract:
//   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
// The DSH web boot concatenates plugin client files into one classic script;
// a raw ES module there throws "Cannot use import statement outside a module",
// and a single entry that fails to activate makes the whole boot fatal.
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'

const src = await readFile('.client-build/index.js', 'utf8')
if (/^\s*(import|export)\s/m.test(src)) throw new Error('client build still contains ES module syntax')
const body = src.replace(/^"use strict";\s*/, '')
const out = `window.__ModuleLoader__.load({
  id: "dsh-agent-compare",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  },
});
`
await mkdir('lib', { recursive: true })
await writeFile('lib/client.js', out)
await rm('.client-build', { recursive: true, force: true })
console.log(`lib/client.js: ${out.length} bytes`)
