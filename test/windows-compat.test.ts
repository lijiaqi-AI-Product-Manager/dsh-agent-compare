import { describe, expect, it } from 'vitest'
import { WindowsCompatObserver } from '../src/core/windows-compat.ts'

describe('observed Windows compatibility diagnostics', () => {
  it('keeps missing or inactive diagnostics distinct from an active hook', () => {
    for (const mode of ['unknown', 'off', 'not-required'] as const) {
      const observer = new WindowsCompatObserver()
      observer.prepare({ mode, observedHooks: [] })('[agent-compare/windows-compat] esbuild-service\n')
      expect(observer.snapshot()).toEqual({ mode, observedHooks: [] })
    }
  })

  it('observes complete known lines across chunks and isolates pending command fragments', () => {
    const observer = new WindowsCompatObserver(), first = observer.prepare({ mode: 'auto', observedHooks: [] })
    first('ordinary output\n[agent-compare/windows-comp')
    first('at] esbuild-service\r\n[agent-compare/windows-compat] esbuild-version\n')
    first('[agent-compare/windows-compat] unsupported\n')
    first('[agent-compare/windows-compat] vite-')
    const second = observer.prepare({ mode: 'auto', observedHooks: [] })
    second('net-use\n[agent-compare/windows-compat] esbuild-service\n')
    expect(observer.snapshot()).toEqual({ mode: 'auto', observedHooks: ['esbuild-service', 'esbuild-version'] })
    first('net-use\n')
    expect(observer.snapshot().observedHooks).toEqual(['esbuild-service', 'esbuild-version', 'vite-net-use'])
  })

  it('bounds incomplete lines and rejects a mode change in the same verification', () => {
    const observer = new WindowsCompatObserver(), feed = observer.prepare({ mode: 'auto', observedHooks: [] })
    feed('x'.repeat(2_000_000))
    feed('\n[agent-compare/windows-compat] vite-net-use\n')
    const snapshot = observer.snapshot()
    expect(snapshot.observedHooks).toEqual(['vite-net-use'])
    expect(() => observer.prepare({ mode: 'off', observedHooks: [] })).toThrow(/发生变化/)
    expect(observer.snapshot()).toEqual(snapshot)
  })
})
