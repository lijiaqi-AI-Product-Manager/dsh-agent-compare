import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { publicView } from '../src/core/run-view.ts'
import { fixtureRecord } from './record-fixture.ts'

describe('salvage offers', () => {
  it('offers to verify written work only when the copy may hold some', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ac-salvage-'))
    const record = fixtureRecord()
    const fail = (message: string, stage: 'generating' | 'sealing') => ({ ...record.candidates[0]!, dir, stage: 'failed' as const, error: { stage, message } })
    record.candidates = [fail('Agent 没有改动任何文件。', 'sealing'), fail('超出生成时间预算（30 分钟），已停止这个候选', 'generating')]
    const view = publicView(record)
    expect(view.candidates.map(c => c.salvageable)).toEqual([false, true])
    record.candidates = [fail('超出生成时间预算（30 分钟）时还没有改动任何文件。', 'sealing'), fail('副本内容与封存的版本不一致', 'sealing')]
    expect(publicView(record).candidates.map(c => c.salvageable)).toEqual([false, true])
  })
})
