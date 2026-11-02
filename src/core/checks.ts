import { createHash } from 'node:crypto'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { run } from './proc.ts'
import type { BrowserCheck, CheckResult, ChecksSpec } from './types.ts'

export function checksSha256(spec: ChecksSpec): string {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex')
}

const tailOf = (s: string, n = 1500): string => (s.length > n ? s.slice(-n) : s)

export async function runCommandChecks(dir: string, spec: ChecksSpec, signal?: AbortSignal): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  for (const cmd of spec.commands) {
    const started = Date.now()
    if (signal?.aborted) {
      results.push({ name: cmd.name, outcome: 'skipped', durationMs: 0, tail: '', reason: 'cancelled' })
      continue
    }
    try {
      const r = await run(cmd.argv, {
        cwd: dir,
        env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
        timeoutMs: cmd.timeoutMs ?? 180_000,
        ...(signal === undefined ? {} : { signal }),
      })
      const outcome = r.timedOut ? 'timeout' : r.aborted ? 'skipped' : r.code === 0 ? 'passed' : 'failed'
      results.push({ name: cmd.name, outcome, durationMs: Date.now() - started, tail: tailOf(`${r.stdout}\n${r.stderr}`.trim()), ...(r.aborted ? { reason: 'cancelled' } : {}) })
    } catch (error) {
      results.push({ name: cmd.name, outcome: 'failed', durationMs: Date.now() - started, tail: '', reason: (error as Error).message })
    }
  }
  return results
}

interface PwPage {
  on(event: 'console', cb: (m: { type(): string; text(): string; location(): { url: string } }) => void): void
  on(event: 'pageerror', cb: (e: Error) => void): void
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<unknown>
  waitForSelector(sel: string, opts: { timeout: number }): Promise<unknown>
  textContent(sel: string): Promise<string | null>
  screenshot(opts: { path: string; fullPage: boolean }): Promise<unknown>
}
interface PwBrowser {
  newContext(opts: { viewport: { width: number; height: number } }): Promise<{ newPage(): Promise<PwPage>; close(): Promise<void> }>
  close(): Promise<void>
}
interface PwModule {
  chromium: { launch(opts: { channel?: string; headless: boolean }): Promise<PwBrowser> }
}

async function launchBrowser(): Promise<{ browser: PwBrowser; channel: string } | { error: string }> {
  let pw: PwModule
  try {
    pw = (await import('playwright-core' as string)) as PwModule
  } catch {
    return { error: 'playwright-core is not installed' }
  }
  const channels = process.platform === 'win32' ? ['msedge', 'chrome'] : ['chrome', 'msedge', 'chromium']
  const errors: string[] = []
  for (const channel of channels) {
    try {
      return { browser: await pw.chromium.launch({ channel, headless: true }), channel }
    } catch (error) {
      errors.push(`${channel}: ${(error as Error).message.split('\n')[0]}`)
    }
  }
  return { error: `no system browser found (${errors.join('; ')})` }
}

/**
 * Load the candidate's running app in a fresh browser context: it must render,
 * meet the optional text/selector expectation, and (by default) raise no
 * console errors. A screenshot is saved for the report.
 */
export async function runBrowserCheck(url: string, check: BrowserCheck, screenshotFile: string): Promise<CheckResult & { screenshot?: string }> {
  const started = Date.now()
  const launched = await launchBrowser()
  if ('error' in launched) return { name: 'browser', outcome: 'skipped', durationMs: Date.now() - started, tail: '', reason: launched.error }
  const { browser } = launched
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    const consoleErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      // Browsers request /favicon.ico on their own; a project without one is not a broken app.
      if (/\/favicon\.ico(\?|$)/.test(m.location().url)) return
      const where = m.location().url
      consoleErrors.push(where ? `${m.text()} (${new URL(where).pathname})` : m.text())
    })
    page.on('pageerror', (e) => consoleErrors.push(e.message))
    const target = new URL(check.path ?? '/', url).href
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 })
    const problems: string[] = []
    if (check.expectSelector !== undefined) {
      try { await page.waitForSelector(check.expectSelector, { timeout: 5_000 }) } catch { problems.push(`selector not found: ${check.expectSelector}`) }
    }
    if (check.expectText !== undefined) {
      const body = (await page.textContent('body')) ?? ''
      if (!body.includes(check.expectText)) problems.push(`text not found: ${check.expectText}`)
    }
    if ((check.failOnConsoleError ?? true) && consoleErrors.length > 0) problems.push(`console errors: ${consoleErrors.slice(0, 3).join(' | ')}`)
    await mkdir(path.dirname(screenshotFile), { recursive: true })
    await page.screenshot({ path: screenshotFile, fullPage: false })
    await context.close()
    return {
      name: 'browser',
      outcome: problems.length === 0 ? 'passed' : 'failed',
      durationMs: Date.now() - started,
      tail: tailOf(problems.join('\n')),
      screenshot: screenshotFile,
      ...(problems.length === 0 ? {} : { reason: problems[0] }),
    }
  } catch (error) {
    return { name: 'browser', outcome: 'failed', durationMs: Date.now() - started, tail: '', reason: (error as Error).message.split('\n')[0] }
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Score for "which candidate did the checks favour": passes minus failures; skips are neutral. */
export function checksScore(results: readonly CheckResult[] | undefined): number | undefined {
  if (results === undefined) return undefined
  return results.reduce((s, r) => s + (r.outcome === 'passed' ? 1 : r.outcome === 'skipped' ? 0 : -1), 0)
}
