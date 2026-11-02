import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import vm from 'node:vm'

// Guards the failure that bricked a real DSH desktop boot: the client file must
// be a classic script registering through window.__ModuleLoader__, and apply()
// must never throw even when slots are missing.
const file = 'lib/client.js'

describe.skipIf(!existsSync(file))('client bundle', () => {
  const src = readFileSync(file, 'utf8')

  it('parses as a classic script (no import/export statements)', () => {
    expect(() => new vm.Script(src)).not.toThrow()
  })

  function load(slots: unknown) {
    let factory: ((req: (id: string) => unknown) => Record<string, any>) | undefined
    const window = { __ModuleLoader__: { load: (spec: { id: string; factory: typeof factory }) => { expect(spec.id).toBe('dsh-agent-compare'); factory = spec.factory } } }
    vm.runInNewContext(src, { window, console })
    const requested: string[] = []
    const react = { createElement: () => null, useState: (v: unknown) => [v, () => {}], useEffect: () => {}, useCallback: (f: unknown) => f, useRef: () => ({ current: null }), Fragment: 'f' }
    const exports = factory!((id) => { requested.push(id); if (id === 'react') return react; throw new Error(`unexpected require ${id}`) })
    return { exports, requested, slots }
  }

  it('registers through the module loader, requires only react, and exports apply/inject', () => {
    const { exports, requested } = load(undefined)
    expect(requested).toEqual(['react'])
    expect(typeof exports.apply).toBe('function')
    expect(exports.inject).toEqual(['slots'])
  })

  it('apply registers both slots and does not throw when a slot is unavailable', () => {
    const { exports } = load(undefined)
    const names: string[] = []
    exports.apply({ slots: { inject: (name: string, cb: () => () => void) => { names.push(name); return cb() }, register: () => () => {} } })
    expect(names).toEqual(['conversation.session.header.utilities', 'shell.overlay'])
    expect(() => exports.apply({ slots: { inject: () => { throw new Error('no such slot') }, register: () => () => {} } })).not.toThrow()
  })
})
