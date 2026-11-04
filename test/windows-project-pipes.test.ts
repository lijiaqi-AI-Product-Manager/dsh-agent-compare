import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'

const require = createRequire(import.meta.url)
const compat = require('../lib/core/windows-project-pipes.cjs') as typeof import('../src/core/windows-project-pipes.cts')
const cp = require('node:child_process') as typeof import('node:child_process')
const fs = require('node:fs') as typeof import('node:fs')

describe('Windows project pipe compatibility', () => {
  it('accepts only the current logon SID shape for private pipe security', () => {
    const sid = Buffer.from([1, 3, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 42, 0, 0, 0, 99, 0, 0, 0])
    expect(compat.logonSidString(sid)).toBe('S-1-5-5-42-99')
    expect(() => compat.logonSidString(sid.subarray(0, 16))).toThrow('invalid process logon SID')
    sid.writeUInt32LE(21, 8)
    expect(() => compat.logonSidString(sid)).toThrow('private logon SID')
  })
  it('limits native service handling to versioned esbuild services', () => {
    expect(compat.isEsbuildService('C:\\a space\\esbuild.exe', ['--service=0.21.5', '--ping'])).toBe(true)
    expect(compat.isEsbuildService('/project/esbuild', ['--service=0.28.2'])).toBe(true)
    for (const args of [[], ['--version'], ['--service=invalid']]) expect(compat.isEsbuildService('esbuild.exe', args)).toBe(false)
    expect(compat.isEsbuildService('another.exe', ['--service=0.28.2'])).toBe(false)
  })

  it('forwards unrelated commands and restores builtin methods', () => {
    const spawn = vi.spyOn(cp, 'spawn').mockReturnValue(new EventEmitter() as any)
    const sync = vi.spyOn(cp, 'execFileSync').mockReturnValue(Buffer.from('original'))
    const restore = compat.installEsbuildCompatibility()
    try {
      cp.spawn('another', ['--version'], { stdio: 'inherit' })
      expect(spawn).toHaveBeenCalledWith('another', ['--version'], { stdio: 'inherit' })
      expect(cp.execFileSync('another', ['--version'])).toEqual(Buffer.from('original'))
    } finally { restore(); spawn.mockRestore(); sync.mockRestore() }
  })

  it('captures synchronous output without pipes and removes owned files on success or failure', () => {
    const made = vi.spyOn(fs, 'mkdtempSync')
    const spawn = vi.spyOn(cp, 'spawnSync').mockImplementation((_file: any, _args: any, options: any) => {
      expect(options.stdio[0]).toBe('ignore')
      expect(options.stdio.slice(1).every((fd: unknown) => typeof fd === 'number')).toBe(true)
      fs.writeSync(options.stdio[1], '0.28.2\n')
      return { status: 0, signal: null, pid: 123 } as any
    })
    try {
      expect(compat.captureSync('esbuild.exe', ['--version'], { encoding: 'utf8' })).toBe('0.28.2\n')
      expect(fs.existsSync(made.mock.results.at(-1)!.value)).toBe(false)
      spawn.mockImplementation((_file: any, _args: any, options: any) => {
        fs.writeSync(options.stdio[2], 'failed-version')
        return { status: 17, signal: null, pid: 123 } as any
      })
      expect(() => compat.captureSync('esbuild.exe', ['--version'])).toThrow('failed-version')
      expect(fs.existsSync(made.mock.results.at(-1)!.value)).toBe(false)
      spawn.mockImplementation(() => { throw new Error('spawn denied') })
      expect(() => compat.captureSync('esbuild.exe', ['--version'])).toThrow('spawn denied')
      expect(fs.existsSync(made.mock.results.at(-1)!.value)).toBe(false)
    } finally { spawn.mockRestore(); made.mockRestore() }
  })

  it('reports output overflow without claiming version validation succeeded', () => {
    const spawn = vi.spyOn(cp, 'spawnSync').mockImplementation((_file: any, _args: any, options: any) => {
      fs.writeSync(options.stdio[1], 'too long')
      return { status: 0, signal: null, pid: 123 } as any
    })
    try { expect(() => compat.captureSync('esbuild.exe', ['--version'], { maxBuffer: 3 })).toThrow(expect.objectContaining({ code: 'ENOBUFS' })) }
    finally { spawn.mockRestore() }
  })
})
