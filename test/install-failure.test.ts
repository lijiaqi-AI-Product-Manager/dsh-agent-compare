import { describe, expect, it } from 'vitest'
import { installFailure } from '../src/core/install-failure.ts'

const result = (stderr = '', stdout = '') => ({ stderr, stdout, timedOut: false, aborted: false })

describe('installation diagnosis from observed failures', () => {
  it.each(['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN'])('keeps %s separate from a lock mismatch', code => {
    const failure = installFailure(result(`npm error code ${code}\nnpm error network request failed`))
    expect(failure).toMatchObject({ kind: 'network', code })
    expect(failure.hint).toContain('无需因此修改锁文件')
  })
  it.each(['E401', 'E403', 'ENEEDAUTH', 'ERR_PNPM_FETCH_401', 'YN0041'])('identifies registry access failure %s', code => {
    expect(installFailure(result(`installation failed ${code}`))).toMatchObject({ kind: 'authentication', code })
  })
  it.each(['EACCES', 'EPERM', 'ENOSPC', 'EBUSY', 'EROFS'])('identifies filesystem failure %s', code => {
    expect(installFailure(result(`npm error code ${code}`))).toMatchObject({ kind: 'filesystem', code })
  })
  it.each(['EBADENGINE', 'EBADPLATFORM', 'ERR_PNPM_UNSUPPORTED_ENGINE'])('identifies an incompatible runtime %s', code => {
    expect(installFailure(result(`installation failed ${code}`))).toMatchObject({ kind: 'runtime', code })
  })
  it.each([
    'npm error code EUSAGE\nnpm ci can only install packages when your package.json and package-lock.json are in sync.\nMissing: vite@8.3.5 from lock file',
    'npm error Invalid: lock file\'s react@18.3.1 does not satisfy react@19.3.1',
    'ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile',
    'YN0028 The lockfile would have been modified by this install',
  ])('identifies a documented lock mismatch without unlocking it', text => {
    const failure = installFailure(result(text))
    expect(failure.kind).toBe('lockfile')
    expect(failure.hint).toContain('不会改用非冻结安装')
  })
  it('does not diagnose a lock mismatch from an exit status or generic usage failure', () => {
    for (const text of ['', 'npm error code EUSAGE\nUsage: npm ci', 'postinstall exited with code 1']) expect(installFailure(result(text)).kind).toBe('unknown')
  })
  it('uses actual stop and timeout flags before interpreting secondary output', () => {
    expect(installFailure({ ...result('ECONNRESET'), timedOut: true }).kind).toBe('timeout')
    expect(installFailure({ ...result('ENOTFOUND'), timedOut: true, aborted: true }).kind).toBe('cancelled')
  })
  it('retains stdout errors when stderr only contains warnings', () => {
    expect(installFailure(result('a warning', 'npm error code ECONNRESET')).kind).toBe('network')
  })
  it('redacts recognizable credentials and bounds retained diagnostic output', () => {
    const token = 'npm_' + 'a'.repeat(40), password = 'private-password', bearer = 'private-bearer-value'
    const failure = installFailure(result(`npm error code E401\nhttps://user:${password}@registry.example.test/pkg\nAuthorization: Bearer ${bearer}\n_authToken=${token}\n${'x'.repeat(9000)}\nfinal cause`))
    expect(failure.diagnostic).not.toContain(token)
    expect(failure.diagnostic).not.toContain(password)
    expect(failure.diagnostic).not.toContain(bearer)
    expect(failure.diagnostic!.length).toBeLessThanOrEqual(1200)
    expect(failure.diagnostic).toContain('final cause')
  })
})
