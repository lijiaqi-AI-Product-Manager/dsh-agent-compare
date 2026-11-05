import { describe, expect, it } from 'vitest'
import { sessionTiming } from '../src/host/timing.ts'

describe('observed session intervals', () => {
  it('unions overlapping tools and steps without counting concurrent time twice', () => {
    const events = [
      { type: 'step/start', time: 0, data: { turn: 1, step: 1 } },
      { type: 'tool/call', time: 20, data: { callId: 'a', name: 'read' } },
      { type: 'tool/call', time: 30, data: { callId: 'b', name: 'read' } },
      { type: 'tool/result', time: 60, data: { message: { toolCallId: 'a' } } },
      { type: 'tool/result', time: 80, data: { message: { toolCallId: 'b' } } },
      { type: 'step/end', time: 100, data: { turn: 1, step: 1 } },
    ]
    expect(sessionTiming(events)).toEqual({ stepMs: 100, toolMs: 60, otherStepMs: 40, completedSteps: 1, completedCalls: 2, incomplete: 0, tools: [{ name: 'read', calls: 2, completed: 2, wallMs: 60 }] })
  })
  it('does not replace missing timestamps, unpaired calls or invalid order with zero cost', () => {
    const result = sessionTiming([
      { type: 'step/start', data: { turn: 1, step: 1 } },
      { type: 'tool/call', time: 20, data: { callId: 'a', name: 'shell' } },
      { type: 'tool/result', time: 10, data: { message: { toolCallId: 'a' } } },
      { type: 'tool/result', time: 40, data: { message: { toolCallId: 'unknown' } } },
    ])
    expect(result.incomplete).toBe(4)
    expect(result).not.toHaveProperty('stepMs')
    expect(result).not.toHaveProperty('toolMs')
    expect(result.tools[0]).not.toHaveProperty('wallMs')
  })
  it('does not let a repeated call id inflate completed duration', () => {
    const result = sessionTiming([
      { type: 'tool/call', time: 0, data: { callId: 'a', name: 'read' } },
      { type: 'tool/call', time: 1, data: { callId: 'a', name: 'read' } },
      { type: 'tool/result', time: 10, data: { message: { toolCallId: 'a' } } },
      { type: 'tool/result', time: 20, data: { message: { toolCallId: 'a' } } },
    ])
    expect(result).toMatchObject({ toolMs: 10, completedCalls: 1, incomplete: 2 })
  })
})
