import { existsSync } from 'node:fs'
import { blindEvidence } from './blind-view.ts'
import { checksScore } from './checks.ts'
import { fileTransferDirectory } from './file-transfer.ts'
import type { Acceptance, AgentRoute, Candidate, CandidateLabel, CandidateStage, CheckResult, PreviewInfo, RunRecord, Strategy, Usage, Verdict } from './types.ts'

const REVEALED_STATES = new Set(['revealed', 'adopting', 'adopted', 'recovery'])
/** Shared by every sealing failure that found no change in the copy. */
export const NO_CHANGES = '没有改动任何文件'

export function canRetryVerification(r: RunRecord, c: Candidate): boolean {
  return (r.state === 'judging' || r.state === 'interrupted') && ['failed', 'interrupted', 'cancelled'].includes(c.stage)
    && c.install?.failure?.kind !== 'lockfile'
    && c.stopUnconfirmed !== true
    && (c.error === undefined || ['installing', 'verifying', 'previewing'].includes(c.error.stage))
    && c.dir !== undefined && existsSync(c.dir) && c.ownerToken !== undefined
    && c.candidateCommit !== undefined && c.candidateTree !== undefined && c.patchFile !== undefined && c.patchSha256 !== undefined
    && (c.verificationHistory?.length ?? 0) < 100
}

/** Which candidate the checks favour: eligibility first, then passes minus failures. */
export function favoured(cands: readonly Candidate[]): RunRecord['checksFavoured'] {
  const score = (c: Candidate): number | undefined => (c.stage === 'ready' ? (c.verdict?.eligible ? 1000 : 0) + (checksScore(c.checks) ?? 0) : undefined)
  const [a, b] = cands.map(score)
  return a === undefined && b === undefined ? 'none' : a === undefined ? 'B' : b === undefined ? 'A' : a > b ? 'A' : b > a ? 'B' : 'tie'
}

/** Decide adoption eligibility from recorded facts only. */
export function verdictOf(c: Candidate, acceptance: Acceptance): Verdict {
  const reasons: string[] = []
  const warnings: string[] = []
  if (c.install?.runtime && (c.install.runtime.hostNode !== acceptance.runtime.node || c.install.runtime.platform !== acceptance.runtime.platform)) warnings.push('验收宿主环境与基线记录不同；请在检查依据中核对版本，不能据此视为完全相同的运行条件')
  // No installation and no project command means no project process to constrain.
  const ranProjectProcesses = c.execution !== undefined || c.install !== undefined || (c.checks ?? []).some(k => k.name !== 'browser')
  if (c.execution?.enforcement === 'partial') warnings.push('宿主报告部分文件写入约束，不能视为完整安全沙箱；文件读取和网络也不在此边界内')
  else if (ranProjectProcesses && c.execution?.enforcement !== 'full') warnings.push('没有完整的项目进程约束记录，不能据此认定执行已隔离')
  const NAMES: Record<string, string> = { typecheck: '类型检查', lint: 'Lint', test: '测试', build: '构建', browser: '页面验收' }
  for (const k of c.checks ?? []) {
    if (k.outcome === 'failed' || k.outcome === 'timeout') reasons.push(`${NAMES[k.name] ?? k.name}${k.outcome === 'timeout' ? '超时' : '未通过'}`)
  }
  const browser = c.checks?.find((k) => k.name === 'browser')
  const scripted = acceptance.checks.browser?.steps?.length || acceptance.checks.browser?.expectSelector || acceptance.checks.browser?.expectText
  // An answer, or files with nothing to serve, has no page to load; only a scripted page acceptance expects one.
  const pageExpected = c.result === undefined || !!scripted
  if (acceptance.checks.browser !== undefined && pageExpected && (browser === undefined || browser.outcome === 'skipped')) {
    if (scripted) reasons.push('页面验收没有运行')
    else warnings.push(`页面加载检查没有运行${browser?.reason ? `（${browser.reason}）` : ''}`)
  }
  // Without a shared build there is no failed build behind a dev server.
  if (c.preview?.kind === 'dev' && acceptance.checks.commands.some(k => k.name === 'build')) reasons.push('构建未通过，只能以开发模式预览')
  if (c.previewNote) warnings.push(c.previewNote)
  if ((c.acceptanceTouched ?? []).length > 0) reasons.push(`改动了验收相关文件：${c.acceptanceTouched!.slice(0, 5).join('、')}`)
  if ((c.drift ?? []).length > 0) reasons.push(`验收过程中副本出现未封存的改动：${c.drift!.slice(0, 5).join('、')}。如为生成的构建产物，请先将输出目录加入 .gitignore，再开始新的比较；已跟踪的源码仍会检查。`)
  if (c.checkedTree === undefined || c.checkedTree !== c.candidateTree) reasons.push('验收的内容不是封存的版本')
  if (c.generation?.ended === 'budget') warnings.push('生成被时间预算截断，Agent 没有说完成；以上结论针对截断时已写的文件')
  if (c.generation?.ended === 'agent-stopped') warnings.push(`Agent 没有正常结束（${c.generation.stopReason ?? '未知'}）；以上结论针对它已写的文件`)
  if (c.dependencyChange) warnings.push('改动了依赖（已按锁文件安装）')
  if (c.install && !c.install.frozen) warnings.push('项目没有锁文件，依赖版本可能与你本地不同')
  return { eligible: c.stage !== 'failed' && reasons.length === 0, reasons, warnings }
}

export interface PublicCandidate {
  readonly label: CandidateLabel
  readonly stage: CandidateStage
  readonly previewUrl?: string
  readonly previewKind?: PreviewInfo['kind']
  /** A result without a live page: an answer, or written files. */
  readonly result?: 'answer' | 'files'
  readonly previewNote?: string
  /** The reply of an `answer` result. It is the result itself, so it is shown before the reveal. */
  readonly answer?: string
  /** Paths a `files` result wrote; they are what the user judges, so they are listed before the reveal. */
  readonly resultFiles?: string[]
  readonly checks?: Candidate['checks']
  readonly execution?: Candidate['execution']
  readonly patchStats?: Candidate['patchStats']
  readonly touchedFiles?: string[]
  readonly timings: Candidate['timings']
  readonly error?: Candidate['error']
  readonly verdict?: Verdict
  readonly usage?: Usage
  readonly install?: Candidate['install']
  readonly verificationHistory?: Candidate['verificationHistory']
  readonly canRetryVerification: boolean
  readonly hasScreenshot: boolean
  readonly hasMobileScreenshot: boolean
  readonly generation?: Candidate['generation']
  readonly progress?: Candidate['progress']
  /** Failed while generating, and its copy is still there: what it wrote can still be verified. */
  readonly salvageable: boolean
  /** Finished, not being served, and its copy still exists: the preview can be started again. */
  readonly canReopenPreview: boolean
  /** Present only after the reveal. */
  readonly strategy?: Strategy
  readonly route?: AgentRoute
  readonly actualRoute?: AgentRoute
  readonly summary?: string
}

export type PublicRun = Omit<RunRecord, 'candidates' | 'baseline' | 'acceptance' | 'adoption'> & {
  candidates: PublicCandidate[]
  baseline: { dirty: boolean; headCommit?: string; repoRoot: string; projectPath?: string }
  acceptance: { source: Acceptance['source']; checks: string[]; steps: number; sha256: string; frozenInstall: boolean }
  adoption?: Omit<NonNullable<RunRecord['adoption']>, 'rehearsal' | 'preAdoptCommit' | 'expectedTree' | 'headBefore' | 'stagedBefore' | 'fileTransfer' | 'transferReturn' | 'retainedTransfers' | 'exportDigests' | 'retainedExports'> & { rehearsed?: boolean; rehearsalChecks?: CheckResult[]; retainedDirectory?: string; retainedDirectories?: string[] }
}

/**
 * The view the UI and the model see. Before the reveal it carries nothing
 * that names the strategy or model; summaries are withheld because agents
 * tend to describe their own approach.
 */
export function publicView(r: RunRecord): PublicRun {
  const revealed = REVEALED_STATES.has(r.state) || r.revealedAt !== undefined
  const { candidates, baseline, acceptance, adoption, ...rest } = r
  const a = adoption
  return {
    ...rest,
    baseline: { dirty: baseline.dirty, repoRoot: baseline.repoRoot, ...(baseline.headCommit === undefined ? {} : { headCommit: baseline.headCommit.slice(0, 12) }), ...(baseline.projectPath ? { projectPath: baseline.projectPath } : {}) },
    acceptance: {
      source: acceptance.source,
      checks: [...acceptance.checks.commands.map((c) => c.name), ...(acceptance.checks.browser ? ['browser'] : [])],
      steps: acceptance.checks.browser?.steps?.length ?? 0,
      sha256: acceptance.sha256.slice(0, 12),
      frozenInstall: acceptance.lockfile !== undefined,
    },
    ...(a === undefined ? {} : {
      adoption: {
        label: a.label, mode: a.mode, state: a.state, startedAt: a.startedAt,
        ...(a.endedAt === undefined ? {} : { endedAt: a.endedAt }),
        ...(a.branch === undefined ? {} : { branch: a.branch }),
        ...(a.exportPath === undefined ? {} : { exportPath: a.exportPath }),
        ...(a.message === undefined ? {} : { message: a.message }),
        ...(a.attention === undefined ? {} : { attention: a.attention }),
        ...(a.writtenPaths === undefined ? {} : { writtenPaths: a.writtenPaths }),
        ...(a.transferDirection === undefined ? {} : { transferDirection: a.transferDirection }),
        ...(a.fileTransfer === undefined ? {} : { retainedDirectory: fileTransferDirectory(baseline.repoRoot, a.fileTransfer) }),
        ...(a.retainedTransfers?.length || a.retainedExports?.length ? { retainedDirectories: [...(a.retainedTransfers ?? []).map(ref => fileTransferDirectory(baseline.repoRoot, ref)), ...(a.retainedExports ?? []).filter(existsSync)] } : {}),
        ...(a.rehearsal === undefined ? {} : { rehearsed: !a.rehearsal.reused, ...(a.rehearsal.checks ? { rehearsalChecks: a.rehearsal.checks } : {}) }),
      },
    }),
    candidates: candidates.map((candidate) => {
      const c = revealed ? candidate : { ...candidate, ...blindEvidence(candidate) }
      return {
      label: c.label,
      stage: c.stage,
      timings: c.timings,
      hasScreenshot: c.screenshot !== undefined,
      hasMobileScreenshot: c.mobileScreenshot !== undefined,
      // A copy sealed with no change has nothing to verify: offering it would only repeat the same failure.
      salvageable: (r.state === 'judging' || r.state === 'interrupted') && (c.stage === 'failed' || c.stage === 'interrupted')
        && (c.error?.stage === 'generating' || (c.error?.stage === 'sealing' && !candidate.error?.message.includes(NO_CHANGES)))
        && c.dir !== undefined && existsSync(c.dir),
      canReopenPreview: c.stage === 'ready' && c.preview === undefined && c.result === undefined && c.dir !== undefined && existsSync(c.dir),
      ...(candidate.result === undefined || c.stage !== 'ready' ? {} : { result: candidate.result }),
      ...(candidate.previewNote === undefined ? {} : { previewNote: candidate.previewNote }),
      ...(candidate.result === 'answer' && c.stage === 'ready' && candidate.summary ? { answer: candidate.summary } : {}),
      ...(candidate.result === 'files' && c.stage === 'ready' && candidate.touchedFiles ? { resultFiles: candidate.touchedFiles.slice(0, 500) } : {}),
      canRetryVerification: canRetryVerification(r, c),
      ...(c.install === undefined ? {} : { install: c.install }),
      ...(c.verificationHistory === undefined ? {} : { verificationHistory: c.verificationHistory }),
      ...(c.generation === undefined ? {} : { generation: c.generation }),
      ...(c.progress === undefined || c.stage !== 'generating' ? {} : { progress: c.progress }),
      ...(c.preview === undefined ? {} : { previewUrl: c.preview.url, previewKind: c.preview.kind }),
      ...(c.checks === undefined ? {} : { checks: c.checks }),
      ...(c.execution === undefined ? {} : { execution: c.execution }),
      ...(!revealed || c.patchStats === undefined ? {} : { patchStats: c.patchStats }),
      ...(!revealed || c.touchedFiles === undefined ? {} : { touchedFiles: c.touchedFiles }),
      ...(c.error === undefined ? {} : { error: c.error }),
      ...(c.verdict === undefined ? {} : { verdict: c.verdict }),
      ...(!revealed || c.usage === undefined ? {} : { usage: c.usage }),
      ...(revealed ? { strategy: c.strategy, route: c.route, ...(c.actualRoute ? { actualRoute: c.actualRoute } : {}), ...(c.summary === undefined ? {} : { summary: c.summary }) } : {}),
      }
    }),
  }
}
