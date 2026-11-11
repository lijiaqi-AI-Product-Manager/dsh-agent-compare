import assert from 'node:assert/strict'

const SUPPORTED_MIRRORS = Object.freeze([
  'https://mirrors.edge.kernel.org/ubuntu',
  'https://archive.ubuntu.com/ubuntu',
  'https://security.ubuntu.com/ubuntu',
  'https://azure.archive.ubuntu.com/ubuntu',
])

async function probeArchive(url, { signal }) {
  const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal })
  await response.body?.cancel()
  if (response.status !== 200) throw Object.assign(new Error('Archive probe unavailable'), { code: `HTTP_${response.status}` })
  return true
}

// A transport probe chooses an available origin; APT still verifies signatures.
// Start with the independently reachable mirror and stop on the first healthy
// origin. Do not let multiple unavailable DNS lookups delay a healthy origin.
// Every request is bounded; APT continues to use the Ubuntu signing keys.
export async function selectUbuntuBrowserMirror({ codename, probe = probeArchive, timeoutMs = 5000 }) {
  assert.match(codename, /^[a-z][a-z0-9-]*$/)
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10000)
  const probes = []
  for (const mirror of SUPPORTED_MIRRORS) {
    const controller = new AbortController()
    let timer, timedOut = false
    let result
    try {
      const expired = new Promise(resolve => { timer = setTimeout(() => { timedOut = true; controller.abort(); resolve(false) }, timeoutMs) })
      const available = Promise.resolve().then(() => probe(`${mirror}/dists/${codename}/InRelease`, { signal: controller.signal }))
      const reachable = (await Promise.race([available, expired])) === true
      result = { mirror, reachable, reason: reachable ? 'ok' : timedOut ? 'timeout' : 'unavailable' }
    } catch (error) {
      const causes = Array.isArray(error?.cause?.errors) ? error.cause.errors : []
      const codes = [error?.code, error?.cause?.code, ...causes.map(item => item?.code)].filter(code => typeof code === 'string' && /^[A-Z0-9_]+$/.test(code))
      result = { mirror, reachable: false, reason: timedOut ? 'timeout' : [...new Set(codes)].join('/') || error?.name || 'unavailable' }
    }
    finally { clearTimeout(timer); controller.abort() }
    probes.push(result)
    if (result.reachable) return { mirror: result.mirror, probes, timeoutMs }
  }
  assert.fail(`No supported Ubuntu HTTPS archive responded after ${probes.length} bounded ${timeoutMs} ms probes; browser dependencies were not changed: ${probes.map(probe => new URL(probe.mirror).hostname + '=' + probe.reason).join(', ')}`)
}

// Ubuntu runners may resolve repositories through local APT mirror lists.
// Change only approved origins; preserve suites, components and keyrings.
export async function configureUbuntuBrowserSources({ lstat, readFile, writeFile }, mirror = 'https://archive.ubuntu.com/ubuntu') {
  assert.ok(SUPPORTED_MIRRORS.includes(mirror), 'Unsupported Ubuntu archive origin')
  let changedSourceFiles = 0
  for (const file of ['/etc/apt/sources.list.d/ubuntu.sources', '/etc/apt/sources.list', '/etc/apt/apt-mirrors.txt', '/etc/apt/apt-mirrors-security.txt']) {
    let info
    try { info = await lstat(file) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size < 1024 * 1024)
    const before = await readFile(file, 'utf8')
    const after = before.replace(/https?:\/\/(?:(?:azure\.archive|archive|security)\.ubuntu\.com|mirrors\.edge\.kernel\.org)\/ubuntu(?=\/|\s|$)/g, mirror)
    if (after !== before) { await writeFile(file, after); changedSourceFiles++ }
  }
  return { changedSourceFiles }
}
