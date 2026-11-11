import assert from 'node:assert/strict'

const SUPPORTED_MIRRORS = Object.freeze([
  'https://archive.ubuntu.com/ubuntu',
  'https://security.ubuntu.com/ubuntu',
  'https://azure.archive.ubuntu.com/ubuntu',
  'https://mirrors.edge.kernel.org/ubuntu',
])

async function probeArchive(url, { signal }) {
  const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal })
  await response.body?.cancel()
  if (response.status !== 200) throw Object.assign(new Error('Archive probe unavailable'), { code: `HTTP_${response.status}` })
  return true
}

// A transport probe chooses an available origin; APT still verifies signatures.
// Probe fixed origins concurrently, with a bound on every request. The last
// origin provides an independent mirror; the Ubuntu signing keys do not change.
export async function selectUbuntuBrowserMirror({ codename, probe = probeArchive, timeoutMs = 5000 }) {
  assert.match(codename, /^[a-z][a-z0-9-]*$/)
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10000)
  const probes = await Promise.all(SUPPORTED_MIRRORS.map(async mirror => {
    const controller = new AbortController()
    let timer, timedOut = false
    try {
      const expired = new Promise(resolve => { timer = setTimeout(() => { timedOut = true; controller.abort(); resolve(false) }, timeoutMs) })
      const available = Promise.resolve().then(() => probe(`${mirror}/dists/${codename}/InRelease`, { signal: controller.signal }))
      const reachable = (await Promise.race([available, expired])) === true
      return { mirror, reachable, reason: reachable ? 'ok' : timedOut ? 'timeout' : 'unavailable' }
    } catch (error) {
      const causes = Array.isArray(error?.cause?.errors) ? error.cause.errors : []
      const codes = [error?.code, error?.cause?.code, ...causes.map(item => item?.code)].filter(code => typeof code === 'string' && /^[A-Z0-9_]+$/.test(code))
      return { mirror, reachable: false, reason: timedOut ? 'timeout' : [...new Set(codes)].join('/') || error?.name || 'unavailable' }
    }
    finally { clearTimeout(timer); controller.abort() }
  }))
  const selected = probes.find(result => result.reachable)
  assert.ok(selected, `No supported Ubuntu HTTPS archive responded within ${timeoutMs} ms; browser dependencies were not changed: ${probes.map(probe => new URL(probe.mirror).hostname + '=' + probe.reason).join(', ')}`)
  return { mirror: selected.mirror, probes, timeoutMs }
}

// Ubuntu runners may resolve repositories through local APT mirror lists.
// Change only approved origins; preserve suites, components and keyrings.
export async function configureUbuntuBrowserSources({ lstat, readFile, writeFile }, mirror = SUPPORTED_MIRRORS[0]) {
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
