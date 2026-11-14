import assert from 'node:assert/strict'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageName = 'dsh-agent-compare'
const dayMs = 86_400_000
const dataPath = 'docs/measurements/npm-total.json'
const assetRoot = 'assets/statistics'
const registryUrl = 'https://registry.npmjs.org/' + packageName
const lastDayUrl = 'https://api.npmjs.org/downloads/point/last-day/' + packageName

export function utcDay(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/)
  const time = Date.parse(value + 'T00:00:00Z')
  assert.ok(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value, 'Invalid UTC date')
  return time
}

export function lifetimeTotal(firstDay, asOf, rows) {
  const first = utcDay(firstDay), end = utcDay(asOf)
  assert.ok(first <= end, 'No available statistics since publication')
  const values = new Map()
  for (const row of rows) {
    const time = utcDay(row.day)
    assert.ok(time >= first && time <= end, 'Daily point outside lifetime coverage')
    assert.ok(Number.isSafeInteger(row.downloads) && row.downloads >= 0, 'Invalid download count')
    assert.ok(!values.has(row.day), 'Duplicate daily point')
    values.set(row.day, row.downloads)
  }
  let total = 0
  const daily = []
  for (let time = first; time <= end; time += dayMs) {
    const day = new Date(time).toISOString().slice(0, 10)
    assert.ok(values.has(day), 'Missing daily point: ' + day)
    const downloads = values.get(day)
    total += downloads
    assert.ok(Number.isSafeInteger(total), 'Total exceeds safe integer precision')
    daily.push({day, downloads})
  }
  return {total, daily}
}

async function publicJson(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(25_000)})
  assert.ok(response.ok, 'Public statistics request failed: ' + response.status)
  return response.json()
}

export async function collectTotal(getJson = publicJson, now = new Date().toISOString()) {
  const [registry, available] = await Promise.all([getJson(registryUrl), getJson(lastDayUrl)])
  assert.equal(registry.name, packageName)
  assert.equal(available.package, packageName)
  assert.equal(available.start, available.end, 'Last-day response must describe one day')
  assert.ok(typeof registry.time?.created === 'string', 'First publication timestamp is unavailable')
  assert.ok(Number.isFinite(Date.parse(registry.time.created)), 'Invalid publication timestamp')
  const firstDay = new Date(registry.time.created).toISOString().slice(0, 10), asOf = available.end
  const first = utcDay(firstDay), end = utcDay(asOf)
  assert.ok(first <= end && end <= utcDay(now.slice(0, 10)), 'Invalid available date')
  const rows = [], ranges = []
  // Each request stays well below the npm API's 18-month range limit.
  for (let start = first; start <= end; start += 365 * dayMs) {
    const stop = Math.min(end, start + 364 * dayMs)
    const from = new Date(start).toISOString().slice(0, 10), to = new Date(stop).toISOString().slice(0, 10)
    const url = 'https://api.npmjs.org/downloads/range/' + from + ':' + to + '/' + packageName
    const response = await getJson(url)
    assert.equal(response.package, packageName)
    assert.equal(response.start, from)
    assert.equal(response.end, to)
    assert.ok(Array.isArray(response.downloads), 'Daily statistics are unavailable')
    rows.push(...response.downloads)
    ranges.push(url)
  }
  const {total, daily} = lifetimeTotal(firstDay, asOf, rows)
  assert.equal(daily.at(-1).downloads, available.downloads, 'Point and range sources disagree')
  return {schema: 'agentcompare.npm-total/v1', package: packageName, firstPublishedAt: registry.time.created,
    firstDay, asOf, total, checkedAt: now, timeZone: 'UTC', unit: 'download requests',
    includes: 'All published versions; repeated and automated requests may be included',
    sources: {registry: registryUrl, lastAvailableDay: lastDayUrl, ranges}, daily}
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const formatted = value => new Intl.NumberFormat('en-US').format(value)

export function renderTotal(snapshot, theme = 'light', mobile = false) {
  const rebuilt = lifetimeTotal(snapshot.firstDay, snapshot.asOf, snapshot.daily)
  assert.equal(rebuilt.total, snapshot.total, 'Saved total differs from daily source data')
  const width = mobile ? 420 : 960, height = mobile ? 238 : 244
  const dark = theme === 'dark', text = dark ? '#e7efff' : '#304b8b', secondary = dark ? '#b2c4e9' : '#63769c'
  const value = formatted(snapshot.total), valueSize = Math.min(mobile ? 52 : 68, (width - 80) / (value.length * 0.62))
  const coverage = snapshot.firstDay + ' → ' + snapshot.asOf + ' UTC'
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="title description">' +
    '<title id="title">AgentCompare · Total npm download requests: ' + escape(value) + '</title>' +
    '<desc id="description">Cumulative official npm requests from first publication. ' + escape(coverage) + '. Requests are not unique users.</desc>' +
    '<defs><linearGradient id="surface" x2="1" y2="1"><stop stop-color="' + (dark ? '#17284b' : '#f5f9ff') + '"/><stop offset="1" stop-color="' + (dark ? '#1d3556' : '#eaf4ff') + '"/></linearGradient>' +
    '<radialGradient id="glow"><stop stop-color="#8ecaff" stop-opacity=".3"/><stop offset="1" stop-color="#8ecaff" stop-opacity="0"/></radialGradient></defs>' +
    '<rect x="1" y="1" width="' + (width - 2) + '" height="' + (height - 2) + '" rx="22" fill="url(#surface)" stroke="' + (dark ? '#3a527c' : '#d7e4f8') + '"/>' +
    '<ellipse cx="' + (width - 30) + '" cy="35" rx="180" ry="140" fill="url(#glow)"/>' +
    '<g font-family="system-ui,-apple-system,Segoe UI,sans-serif">' +
    '<text x="30" y="39" font-size="17" font-weight="650" fill="' + text + '">AgentCompare</text>' +
    '<text x="30" y="66" font-size="' + (mobile ? 14 : 16) + '" fill="' + secondary + '">累计 npm 下载请求 · Total npm requests</text>' +
    '<text x="29" y="139" font-size="' + valueSize + '" font-weight="700" letter-spacing="-1.5" fill="' + (dark ? '#a9ceff' : '#3d62cd') + '">' + escape(value) + '</text>' +
    '<text x="31" y="172" font-size="' + (mobile ? 12 : 14) + '" fill="' + secondary + '">' + escape(coverage) + '</text>' +
    '<path d="M30 188H' + (width - 30) + '" stroke="' + (dark ? '#38517a' : '#d3e2f5') + '"/>' +
    '<text x="31" y="213" font-size="' + (mobile ? 11 : 13) + '" fill="' + secondary + '">All versions · Official npm API · Requests, not users</text></g></svg>\n'
}

export function renderBadge(snapshot) {
  const label = 'npm download/下载量'
  const value = formatted(snapshot.total), left = 152, right = Math.max(66, value.length * 7 + 18), width = left + right
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="20" role="img" aria-label="' + escape(label) + ': ' + escape(value) + '">' +
    '<title>npm total download requests: ' + escape(value) + '; ' + escape(snapshot.firstDay + ' through ' + snapshot.asOf + ' UTC') + '</title>' +
    '<clipPath id="r"><rect width="' + width + '" height="20" rx="4"/></clipPath><g clip-path="url(#r)"><rect width="' + left + '" height="20" fill="#5872b5"/><rect x="' + left + '" width="' + right + '" height="20" fill="#e4efff"/></g>' +
    '<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle"><text x="' + left/2 + '" y="14" fill="#fff">' + escape(label) + '</text><text x="' + (left+right/2) + '" y="14" fill="#304b8b">' + escape(value) + '</text></g></svg>\n'
}

export function totalAssets(snapshot) {
  const files = new Map()
  for (const theme of ['light', 'dark']) for (const mobile of [false, true]) {
    files.set(assetRoot + '/npm-total-' + (mobile ? 'mobile-' : '') + theme + '.svg', renderTotal(snapshot, theme, mobile))
  }
  files.set(assetRoot + '/npm-total-badge.svg', renderBadge(snapshot))
  return files
}

async function main() {
  const offline = process.argv.includes('--render-only') || process.argv.includes('--check')
  let snapshot
  if (offline) snapshot = JSON.parse(await readFile(path.join(root, dataPath), 'utf8'))
  else {
    snapshot = await collectTotal()
    let old
    try { old = JSON.parse(await readFile(path.join(root, dataPath), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    // Rechecking identical source data should not create a timestamp-only commit.
    if (old && old.firstPublishedAt === snapshot.firstPublishedAt && old.asOf === snapshot.asOf &&
        old.total === snapshot.total && JSON.stringify(old.daily) === JSON.stringify(snapshot.daily)) snapshot.checkedAt = old.checkedAt
  }
  const files = totalAssets(snapshot)
  files.set(dataPath, JSON.stringify(snapshot, null, 2) + '\n')
  for (const [file, contents] of files) {
    if (process.argv.includes('--check')) assert.equal(await readFile(path.join(root, file), 'utf8'), contents, 'Stale total asset: ' + file)
    else { await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), contents) }
  }
  console.log(JSON.stringify({firstDay: snapshot.firstDay, asOf: snapshot.asOf, total: snapshot.total, assets: files.size, mode: offline ? 'offline' : 'public-source'}))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
}

