// Diagnose the installed native protocol after a WebDriver startup failure.
// A controlled tab probe is additional evidence, not an acceptance substitute.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inspectPngEvidence } from './png-evidence.mjs'

export async function probeNativeSafariProtocol(options = {}) {
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
    if (pending.length > 4 * 1024 * 1024) { rejectAll(new Error('Native protocol response exceeded its limit')); return }
    let end
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end); pending = pending.slice(end + 1)
      let message
      try { message = JSON.parse(line) } catch { continue }
      const request = requests.get(message.id)
      if (request) message.error ? request.reject(new Error('Native protocol rejected metadata request ' + String(message.error.code))) : request.resolve(message.result)
    }
  })
  const request = async (method, params, timeout = 10000) => {
    const id = ++requestId
    let timer
    try {
      return await new Promise((resolve, reject) => {
        requests.set(id, { resolve, reject })
        timer = setTimeout(() => reject(new Error('Native protocol request timed out')), timeout)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      })
    } finally { clearTimeout(timer); requests.delete(id) }
  }
  try {
    const initialized = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'agent-compare-native-check', version: '1' } })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    const listed = await request('tools/list', {})
    const result = { status: 'metadata-only', protocolVersion: initialized.protocolVersion, tools: listed.tools.map(tool => ({
      name: tool.name, required: tool.inputSchema?.required,
      properties: Object.fromEntries(Object.entries(tool.inputSchema?.properties ?? {}).map(([name, value]) => [name, { type: value.type, enum: value.enum }])),
    })), interactionSchema: listed.tools.find(tool => tool.name === 'page_interactions')?.inputSchema }
    if (options.url && options.output) {
      assert.equal(new URL(options.url).hostname, 'localhost', 'Only the owned local fixture may be opened')
      const call = async (name, args) => {
        const response = await request('tools/call', { name, arguments: args }, 30000)
        if (response.isError) throw new Error('Native protocol tool failed: ' + name)
        return response
      }
      try {
        const created = await call('create_tab', { url: options.url })
        result.tabCreated = true
        const page = await call('evaluate_javascript', { expression: 'JSON.stringify({title:document.title,origin:location.origin,frames:Array.from(document.querySelectorAll("iframe"),frame=>frame.src),ready:document.readyState})' })
        result.document = page.content?.filter(item => item.type === 'text').map(item => item.text.slice(0,6000))
        result.createResponseShape = { structuredKeys: Object.keys(created.structuredContent ?? {}), contentTypes: created.content?.map(item => item.type) }
        const captured = await call('screenshot', {})
        const png = captured.content?.find(item => item.type === 'image' && item.mimeType === 'image/png')
        if (png) {
          const bytes = Buffer.from(png.data, 'base64')
          result.screenshot = inspectPngEvidence(bytes)
          await writeFile(path.join(options.output, 'native-protocol-controlled-tab.png'), bytes)
        }
        result.status = 'controlled-tab-diagnostic'
      } catch (error) { result.controlledTabFailure = error.message }
    }
    return { ...result, stderrBytes }
  } catch (error) { return { status: 'unavailable', reason: error.message, stderrBytes } }
  finally {
    child.stdin.end()
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 1000))])
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}
