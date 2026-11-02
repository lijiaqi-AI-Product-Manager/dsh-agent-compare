import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import type { ChildProcess, SpawnOptions } from 'node:child_process'

const require = createRequire(import.meta.url)
const cp = require('node:child_process') as typeof import('node:child_process')
const fs = require('node:fs') as typeof import('node:fs')
const probe = require('../lib/core/windows-vite-probe.cjs') as typeof import('../src/core/windows-vite-probe.cts')

describe('confined Windows Vite path probe', () => {
  it('activates only for a standard Vite executable entry', () => {
    expect(probe.isViteEntry('C:\\a space\\node_modules\\vite\\bin\\vite.js')).toBe(true)
    expect(probe.isViteEntry('/tmp/project/node_modules/vite/bin/vite.js')).toBe(true)
    expect(probe.isViteEntry('/tmp/project/vite.config.ts')).toBe(false)
    expect(probe.isViteEntry('/tmp/npm-cli.js')).toBe(false)
    expect(probe.isViteEntry(undefined)).toBe(false)
  })

  it('captures the probe through files without creating named pipe stdio and removes its files', async () => {
    const created = vi.spyOn(fs, 'mkdtempSync')
    const spawn = vi.spyOn(cp, 'spawn').mockImplementation((file: any, args: any, options: any) => {
      expect(file).toMatch(/[\\/]System32[\\/]net\.exe$/)
      expect(args).toEqual(['use'])
      expect(options.stdio[0]).toBe('ignore')
      expect(options.stdio.slice(1).every((fd: unknown) => typeof fd === 'number')).toBe(true)
      fs.writeSync(options.stdio[1], 'OK Z: \\\\server\\share\n')
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('close', 0, null))
      return child as ChildProcess
    })
    try {
      const result = await new Promise<{ error: unknown; stdout: string | Buffer }>(resolve => probe.captureNetworkDrives({}, (error, stdout) => resolve({ error, stdout })))
      expect(result.error).toBeNull()
      expect(result.stdout).toContain('server')
      expect(created.mock.results[0]?.value).toBeTypeOf('string')
      expect(fs.existsSync(created.mock.results[0]!.value)).toBe(false)
    } finally { spawn.mockRestore(); created.mockRestore() }
  })

  it('keeps spawn and output-limit failures observable instead of returning successful probe data', async () => {
    const spawn = vi.spyOn(cp, 'spawn').mockImplementation((_file: any, _args: any, options: SpawnOptions) => {
      fs.writeSync((options.stdio as number[])[1]!, 'too much output')
      const child = new EventEmitter()
      queueMicrotask(() => child.emit('close', 0, null))
      return child as ChildProcess
    })
    try {
      const result = await new Promise<{ error: any; stdout: string | Buffer }>(resolve => probe.captureNetworkDrives({ maxBuffer: 3 }, (error, stdout) => resolve({ error, stdout })))
      expect(result.error.code).toBe('ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
      expect(result.stdout).toBe('too')
      spawn.mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EPERM' }) })
      const created = vi.spyOn(fs, 'mkdtempSync')
      try {
        expect(() => probe.captureNetworkDrives({}, () => {})).toThrow('denied')
        expect(fs.existsSync(created.mock.results[0]!.value)).toBe(false)
      } finally { created.mockRestore() }
    } finally { spawn.mockRestore() }
  })

  it('forwards other commands unchanged and restores the previous builtin', () => {
    const original = vi.spyOn(cp, 'exec').mockImplementation(() => new EventEmitter() as ChildProcess)
    const previous = cp.exec
    const restore = probe.installViteProbeCompatibility()
    const options = { windowsHide: true }, callback = () => {}
    try {
      cp.exec('a different command', options, callback)
      expect(original).toHaveBeenCalledWith('a different command', options, callback)
    } finally { restore(); expect(cp.exec).toBe(previous); original.mockRestore() }
  })
  it('reports a synchronous optional-probe denial asynchronously without claiming a process ran', async () => {
    const spawn = vi.spyOn(cp, 'spawn').mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EPERM' }) })
    const restore = probe.installViteProbeCompatibility()
    let inCall = true
    try {
      const result = new Promise<void>(resolve => {
        const child = cp.exec('net use', { windowsHide: true }, (error, stdout) => {
          expect(inCall).toBe(false)
          expect(error?.code).toBe('EPERM')
          expect(stdout).toBe('')
          expect(child.pid).toBeUndefined()
          resolve()
        })
      })
      inCall = false
      await result
    } finally { restore(); spawn.mockRestore() }
  })
})
