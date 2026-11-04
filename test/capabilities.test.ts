import { describe, expect, it } from 'vitest'
import { clientCapabilities } from '../src/client/capabilities.ts'
import { hostCapabilities } from '../src/host/capabilities.ts'

const noop = () => {}
const state = { draft: 'keep my task', draftRev: 2, phase: 'plain' }
const shell = () => ({ beginCommand: noop, state: { getSnapshot: () => state, subscribe: noop } })
const services = () => ({ isolation: 'own-root' as const, agents: { create: noop }, sandbox: { confine: noop }, commands: { register: noop }, sessionController: { resolveAgent: noop }, scrubbedParentEnv: true })

describe('host prerequisite diagnostics', () => {
  it('observes the input without editing its state', () => {
    expect(clientCapabilities(shell(), { bail: noop }, { execute: noop })).toEqual({ ok: true, canExecute: true, missing: [] })
    expect(state.draft).toBe('keep my task')
  })
  it.each(['beginCommand', 'subscribe', 'getSnapshot', 'bail', 'execute'])('reports missing client %s', key => {
    const input: any = shell(), scope: any = { bail: noop }, commands: any = { execute: noop }
    if (key in input) delete input[key]
    else if (key in input.state) delete input.state[key]
    else if (key in scope) delete scope[key]
    else delete commands[key]
    const result = clientCapabilities(input, scope, commands)
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toContain(key)
    expect(result.canExecute).toBe(key !== 'execute')
  })
  it('contains a changed or throwing snapshot contract', () => {
    expect(clientCapabilities({ ...shell(), state: { subscribe: noop, getSnapshot: () => { throw new Error('unavailable') } } }, { bail: noop }, { execute: noop }).missing).toContain('input.state.getSnapshot')
    expect(clientCapabilities({ ...shell(), state: { subscribe: noop, getSnapshot: () => ({}) } }, { bail: noop }, { execute: noop }).ok).toBe(false)
  })
  it.each(['agents', 'sandbox', 'commands', 'scrubbedParentEnv'])('fails closed without host %s', key => {
    const value: any = services()
    delete value[key]
    expect(hostCapabilities(value).ok).toBe(false)
    expect(hostCapabilities(value).missing).toHaveLength(1)
  })
  it('discloses missing restoration without disabling attached sessions', () => {
    expect(hostCapabilities({ ...services(), sessionController: undefined })).toEqual({ ok: true, missing: [], warnings: ['sessionController.resolveAgent'] })
  })
  it('requires the configured shared-root runner instead of pretending it is own-root', () => {
    expect(hostCapabilities({ ...services(), isolation: 'shared-root', agents: undefined }).missing).toEqual(['subagents.startActivation'])
    expect(hostCapabilities({ ...services(), isolation: 'shared-root', agents: undefined, subagents: { startActivation: noop } }).ok).toBe(true)
  })
})
