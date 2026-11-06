// Wrap the CommonJS client build in the DSH web client loader contract:
//   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
// The DSH web boot concatenates plugin client files into one classic script;
// a raw ES module there throws "Cannot use import statement outside a module",
// and a single entry that fails to activate makes the whole boot fatal.
import { writeFile, mkdir } from 'node:fs/promises'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  charset: 'utf8',
  external: ['react'],
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: true,
  write: false,
})
const src = result.outputFiles[0].text
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
console.log(`lib/client.js: ${out.length} bytes`)
