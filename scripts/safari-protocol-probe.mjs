// Metadata only: inspect the installed native protocol after a driver startup
// failure. This does not replace any interactive or visual acceptance result.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

export async function probeNativeSafariProtocol() {
  assert.equal(process.platform, 'darwin')
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
  const child = spawn('/usr/bin/safaridriver', ['--mcp'], { stdio: ['pipe', 'pipe', 'pipe'] })
  let pending = '', stderrBytes = 0, requestId = 0
  const requests = new Map()
  const rejectAll = error => { for (const request of requests.values()) request.reject(error) }
  child.on('error', rejectAll)
  child.on('close', () => rejectAll(new Error('Native protocol process closed')))
  child.stdin.on('error', rejectAll)
  child.stderr.on('data', data => { stderrBytes += data.length })
  child.stdout.setEncoding('utf8').on('data', chunk => {
    pending += chunk
    if (pending.length > 1024 * 1024) { rejectAll(new Error('Native protocol metadata exceeded its limit')); return }
    let end
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end); pending = pending.slice(end + 1)
      let message
      try { message = JSON.parse(line) } catch { continue }
      const request = requests.get(message.id)
      if (request) message.error ? request.reject(new Error('Native protocol rejected metadata request ' + String(message.error.code))) : request.resolve(message.result)
    }
  })
  const request = async (method, params) => {
    const id = ++requestId
    let timer
    try {
      return await new Promise((resolve, reject) => {
        requests.set(id, { resolve, reject })
        timer = setTimeout(() => reject(new Error('Native protocol metadata timed out')), 10000)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      })
    } finally { clearTimeout(timer); requests.delete(id) }
  }
  try {
    const initialized = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'agent-compare-native-check', version: '1' } })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    const listed = await request('tools/list', {})
    return { status: 'metadata-only', protocolVersion: initialized.protocolVersion, tools: listed.tools.map(tool => ({
      name: tool.name, required: tool.inputSchema?.required,
      properties: Object.fromEntries(Object.entries(tool.inputSchema?.properties ?? {}).map(([name, value]) => [name, { type: value.type, enum: value.enum }])),
    })), stderrBytes }
  } catch (error) { return { status: 'unavailable', reason: error.message, stderrBytes } }
  finally {
    child.stdin.end()
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 1000))])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}
