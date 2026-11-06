import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Guards the failure that bricked a real DSH desktop boot: the client file must
// be a classic script registering through window.__ModuleLoader__, and apply()
// must never throw even when slots are missing.
const file = 'lib/client.js'

describe('client bundle', () => {
  const src = readFileSync(file, 'utf8')

  it('parses as a classic script (no import/export statements)', () => {
    expect(() => new vm.Script(src)).not.toThrow()
  })

  function load(slots: unknown) {
    let factory: ((req: (id: string) => unknown) => Record<string, any>) | undefined
    const window = { __ModuleLoader__: { load: (spec: { id: string; factory: typeof factory }) => { expect(spec.id).toBe('dsh-agent-compare'); factory = spec.factory } } }
    vm.runInNewContext(src, { window, console })
    const requested: string[] = []
    const elements: any[] = []
    const react = { createElement: (type: unknown, props: unknown, ...children: unknown[]) => { const element = { type, props, children }; elements.push(element); return element }, useState: (v: unknown) => [v, () => {}], useEffect: () => {}, useCallback: (f: unknown) => f, useRef: () => ({ current: null }), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(), Fragment: 'f' }
    const exports = factory!((id) => { requested.push(id); if (id === 'react') return react; throw new Error(`unexpected require ${id}`) })
    return { exports, requested, slots, elements }
  }

  it('registers through the module loader, requires only react, and exports apply/inject', () => {
    const { exports, requested } = load(undefined)
    expect([...new Set(requested)]).toEqual(['react'])
    expect(typeof exports.apply).toBe('function')
    expect(exports.inject).toEqual(['slots', 'remote', 'remote.commands'])
  })

  it('renders a concrete diagnostic when the input contract is missing', () => {
    const { exports, elements } = load(undefined)
    let component: ((props: { sessionId: string }) => unknown) | undefined
    let dock: ((props: { sessionId: string }) => any) | undefined
    const scope = { get: () => ({ input: { for: () => ({ state: { getSnapshot: () => ({ draft: 'keep this task', draftRev: 1, phase: 'plain' }), subscribe: () => () => {} } }) } }), bail: () => true }
    exports.apply({ get: () => ({ scope: () => scope }), remote: { commands: { execute: () => {} } }, slots: { inject: (_name: string, callback: () => unknown) => callback(), register: (spec: any, value: any) => { if (spec.name === 'conversation.input.left') component = value; if (spec.name === 'conversation.input.dock') dock = value; return () => {} } } })
    const render = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach(render); return }
      if (typeof node.type === 'function') render(node.type(node.props))
      else node.children?.forEach(render)
    }
    expect(() => render(component!({ sessionId: 'missing-input' }))).not.toThrow()
    expect(() => render(dock!({ sessionId: 'missing-input' }))).not.toThrow()
    expect(elements.some(element => element.props?.role === 'alert')).toBe(true)
    expect(elements.some(element => element.children.some((child: unknown) => typeof child === 'string' && child.includes('input.beginCommand')))).toBe(true)
    expect(elements.find(element => element.props?.['aria-label'] === 'A|B 对比模式')?.props.disabled).toBe(true)
  })

  it('apply registers every surface and does not throw when a slot is unavailable', () => {
    const { exports } = load(undefined)
    const names: string[] = []
    const specs: Array<Record<string, unknown>> = []
    exports.apply({ slots: { inject: (name: string, cb: () => () => void) => { names.push(name); return cb() }, register: (spec: Record<string, unknown>) => { specs.push(spec); return () => {} } } })
    expect(names).toEqual(['conversation.session.header.utilities', 'conversation.hero.options', 'conversation.input.left', 'conversation.input.dock', 'conversation.chat.commandview', 'tool.call.toolview', 'shell.overlay'])
    // Keyed slots render our views only for our command and our tool.
    expect(specs.find((s) => s.name === 'conversation.chat.commandview')?.key).toBe('ab')
    expect(specs.find((s) => s.name === 'tool.call.toolview')?.key).toBe('agent_compare_start')
    expect(() => exports.apply({ slots: { inject: () => { throw new Error('no such slot') }, register: () => () => {} } })).not.toThrow()
  })
})
