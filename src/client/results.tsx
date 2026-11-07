/**
 * Results that have no live page, and what the settings strip says about the
 * conversation's directory.
 *
 * An answer is the version's reply itself; written files are listed and can
 * be opened one by one. Both are what the user judges, so they are shown
 * before the reveal. Directory notes explain how this directory is compared,
 * and a folder outside Git can be turned into a repository on request.
 */
import React, { useEffect, useState } from 'react'
import { t } from './i18n.js'
import { Diagnostic } from './language.js'
import type { Cand, ProjectSetup, Run } from './model.js'

type Call = <T>(method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<T>
interface FileContent { path: string; size: number; binary: boolean; deleted?: true; text?: string; truncated: boolean }

const bytes = (size: number): string => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

export function ResultView({ run, c, call }: { run: Run; c: Cand; call: Call }): React.ReactElement {
  if (c.result === 'answer') {
    return <div className="ac-result" role="region" aria-label={t("候选 {0} 的回答", { 0: c.label })}>
      <div className="ac-result-head"><b>{t("回答")}</b><span className="ac-meta">{t("这一版只给出回答，没有写文件")}</span></div>
      <div className="ac-answer" tabIndex={0}>{c.answer ?? c.summary ?? t("（没有内容）")}</div>
    </div>
  }
  return <FilesView run={run} c={c} call={call} />
}

function FilesView({ run, c, call }: { run: Run; c: Cand; call: Call }): React.ReactElement {
  const files = c.resultFiles ?? c.touchedFiles ?? []
  const [open, setOpen] = useState<string | undefined>(files[0])
  const [content, setContent] = useState<FileContent>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (open === undefined) return
    const controller = new AbortController()
    setContent(undefined); setError(undefined)
    call<FileContent>('candidateFile', { runId: run.runId, label: c.label, path: open }, controller.signal)
      .then(value => setContent(value), (failure: Error) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [run.runId, c.label, open])
  return <div className="ac-result" role="region" aria-label={t("候选 {0} 写出的文件", { 0: c.label })}>
    <div className="ac-result-head"><b>{t("写出的文件")}</b><span className="ac-meta">{t("{0} 个文件 · 没有可以直接打开的页面", { 0: files.length })}</span></div>
    {c.previewNote && <p className="ac-meta"><Diagnostic text={c.previewNote} /></p>}
    <div className="ac-files">
      <ul className="ac-file-list" aria-label={t("文件列表")}>
        {files.map(file => <li key={file}><button type="button" className={`ac-file${open === file ? ' on' : ''}`} aria-pressed={open === file} onClick={() => setOpen(file)} title={file}>{file}</button></li>)}
      </ul>
      <div className="ac-file-view" aria-live="polite">
        {error ? <p className="ac-feedback" role="alert"><Diagnostic text={error} /></p>
          : content === undefined ? <p className="ac-meta" role="status">{open ? t("正在读取文件…") : t("这一版没有写文件")}</p>
          : content.deleted ? <p className="ac-meta">{t("这一版删除了这个文件")}</p>
          : content.binary || content.text === undefined ? <p className="ac-meta">{t("二进制或过大的文件（{0}），不在这里显示", { 0: bytes(content.size) })}</p>
          : <><pre className="ac-file-text" tabIndex={0}>{content.text}</pre>{content.truncated && <p className="ac-meta">{t("只显示前 64 KB，共 {0}", { 0: bytes(content.size) })}</p>}</>}
      </div>
    </div>
  </div>
}

/** How this conversation's directory is compared, as short informational lines. */
export function ProjectNotes({ project, sessionId, call, onChanged, disabled }: { project: ProjectSetup; sessionId: string; call: Call; onChanged: () => void; disabled: boolean }): React.ReactElement | null {
  const notes: string[] = []
  if (project.workspace === 'folder') {
    notes.push(project.path
      ? t("当前目录不是 Git 仓库：两版会在新的空白目录里完成，不会改动这里的文件；选定后可以保存到这里的新文件夹。")
      : t("这条对话没有目录：两版会在新的空白目录里完成，结果在卡片里查看。"))
  } else if (project.workspace === 'repository') {
    if (project.projectPath) notes.push(t("项目位于仓库的 {0}/ 目录；安装、检查和预览都在这里运行。", { 0: project.projectPath }))
    if (project.profile === 'node-web') notes.push(t("项目不是 Vite：两版完成后会运行它的 {0} 脚本来显示页面。", { 0: project.script ?? 'dev' }))
    else if (project.profile === 'node') notes.push(t("项目没有 dev 或 start 脚本：比较两版写出的改动和检查结果，没有实时页面。"))
    else if (project.profile === 'static') notes.push(t("静态网页：直接打开 HTML 页面，不安装依赖。"))
    else if (project.profile === 'files') notes.push(t("这个目录没有可运行的网页项目：比较两版的回答和写出的文件。"))
  }
  if (notes.length === 0 && !project.packageNote && !project.canEnableGit) return null
  return <div className="ac-project-notes" role="note">
    {notes.map(note => <p key={note} className="ac-info">{note}</p>)}
    {project.packageNote && <p className="ac-info">{t("package.json 暂时无法使用，这次不安装依赖：")}<Diagnostic text={project.packageNote} /></p>}
    {project.canEnableGit && <EnableGit sessionId={sessionId} folder={project.path} call={call} onEnabled={onChanged} disabled={disabled} />}
  </div>
}

/**
 * Turn the folder into a Git repository so both versions start from its
 * files. It is checked first, and nothing happens until the user confirms.
 */
function EnableGit({ sessionId, folder, call, onEnabled, disabled }: { sessionId: string; folder: string; call: Call; onEnabled: () => void; disabled: boolean }): React.ReactElement {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'checking' } | { kind: 'confirm'; files: number; bytes: number } | { kind: 'enabling' } | { kind: 'refused'; reason: string } | { kind: 'error'; message: string }>({ kind: 'idle' })
  const check = (): void => {
    setState({ kind: 'checking' })
    call<{ ok: true; files: number; bytes: number } | { ok: false; reason: string }>('enableGit', { sessionId, check: true })
      .then(value => setState(value.ok ? { kind: 'confirm', files: value.files, bytes: value.bytes } : { kind: 'refused', reason: value.reason }), (error: Error) => setState({ kind: 'error', message: error.message }))
  }
  const enable = (): void => {
    setState({ kind: 'enabling' })
    call<ProjectSetup>('enableGit', { sessionId })
      .then(() => { setState({ kind: 'idle' }); onEnabled() }, (error: Error) => setState({ kind: 'error', message: error.message }))
  }
  if (state.kind === 'confirm') {
    return <div className="ac-enable-git" role="group" aria-label={t("在此目录启用 Git")}>
      <p>{t("将在 {0} 中创建 Git 仓库（.git 文件夹），不提交、不改动现有文件。之后两版会从这里的 {1} 个文件（{2}）开始，选定的版本可以审查后写回这里。", { 0: folder, 1: state.files.toLocaleString(), 2: bytes(state.bytes) })}</p>
      <div className="ac-row"><button type="button" className="ac-btn" onClick={() => setState({ kind: 'idle' })}>{t("取消")}</button><button type="button" className="ac-btn primary" onClick={enable}>{t("确认启用 Git")}</button></div>
    </div>
  }
  return <div className="ac-enable-git">
    <span>{t("要修改这个目录里的现有文件？")}</span>
    <button type="button" className="ac-text-btn" disabled={disabled || state.kind === 'checking' || state.kind === 'enabling'} onClick={check}>{state.kind === 'checking' ? t("正在检查目录…") : state.kind === 'enabling' ? t("正在启用…") : t("在此目录启用 Git")}</button>
    {state.kind === 'refused' && <p className="ac-feedback" role="alert"><Diagnostic text={state.reason} /></p>}
    {state.kind === 'error' && <p className="ac-feedback" role="alert"><Diagnostic text={state.message} /></p>}
  </div>
}
