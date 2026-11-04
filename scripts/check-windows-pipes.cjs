const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnEsbuildService } = require('../lib/core/windows-project-pipes.cjs')

async function collect(code, args = [], input = Buffer.alloc(0)) {
  const child = spawnEsbuildService(process.execPath, ['-e', code, ...args], { cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] })
  const out = [], err = []
  child.stdout.on('data', b => out.push(b)); child.stderr.on('data', b => err.push(b))
  const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (status, signal) => resolve({ status, signal })) })
  child.stdin.end(input)
  return { ...await closed, stdout: Buffer.concat(out), stderr: Buffer.concat(err) }
}

async function main() {
  const args = ['', 'a space', 'quote"value', 'C:\\a space\\', '中文', '&echo', '%PATH%']
  const input = crypto.randomBytes(2 * 1024 * 1024)
  const code = `const fs=require('node:fs'),crypto=require('node:crypto');const chunks=[];process.stdin.on('data',b=>chunks.push(b));process.stdout.write(Buffer.alloc(1024*1024,65));process.stdin.on('end',()=>{let denied=false;try{fs.writeFileSync(${JSON.stringify(process.argv[2])},'changed')}catch{denied=true}process.stderr.write(JSON.stringify({args:process.argv.slice(1),denied,sha256:crypto.createHash('sha256').update(Buffer.concat(chunks)).digest('hex')}))})`
  const result = await collect(code, args, input)
  assert.equal(result.status, 0); assert.equal(result.signal, null)
  assert.equal(result.stdout.length, 1024 * 1024)
  assert.ok(result.stdout.every(byte => byte === 65))
  assert.deepEqual(JSON.parse(result.stderr.toString()), { args, denied: true, sha256: crypto.createHash('sha256').update(input).digest('hex') })
  const failure = await collect("process.stderr.write('expected-child-failure');process.exitCode=17")
  assert.equal(failure.status, 17); assert.equal(failure.stderr.toString(), 'expected-child-failure')

  const heartbeat = path.join(process.cwd(), 'native-pipe-heartbeat')
  const child = spawnEsbuildService(process.execPath, ['-e', `const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'.'),10);process.stdout.write('ready')`], { cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] })
  const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (status, signal) => resolve({ status, signal })) })
  await new Promise(resolve => child.stdout.once('data', resolve))
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(child.kill('SIGTERM'), true)
  assert.deepEqual(await closed, { status: null, signal: 'SIGTERM' })
  const before = await fs.readFile(heartbeat, 'utf8')
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(await fs.readFile(heartbeat, 'utf8'), before)
  console.log(JSON.stringify({ anonymousPipeInputBytes: input.length, anonymousPipeOutputBytes: result.stdout.length, exactArguments: true, restrictedGrandchild: true, failedExitPreserved: true, cancelledChildStopped: true }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
