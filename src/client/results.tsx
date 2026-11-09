/**
 * Results that have no live page, and what the settings strip says about the
 * conversation's directory.
 *
 * An answer is the version's reply itself, rendered from its Markdown; written
 * files are listed and can be opened one by one. Both are what the user
 * judges, so they are shown before the reveal. Directory notes explain how
 * this directory is compared, and a folder outside Git can be turned into a
 * repository on request.
 */
import React, { useEffect, useState } from 'react'
import { t } from './i18n.js'
import { Diagnostic } from './language.js'
import { parseMarkdown, type Block, type Inline } from './markdown.js'
import type { Cand, ProjectSetup, Run } from './model.js'

type Call = <T>(method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<T>
interface FileContent { path: string; size: number; binary: boolean; deleted?: true; text?: string; truncated: boolean }

const bytes = (size: number): string => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

/** Put `text` on the clipboard: the clipboard API where it is allowed, a selected text area otherwise. */
async function copyText(text: string): Promise<void> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return } } catch { /* fall back below */ }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'; area.style.opacity = '0'; area.style.pointerEvents = 'none'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) throw new Error('copy')
}

/** A button that copies `text` and says so for a moment. */
export function CopyButton({ text, label, className = 'ac-text-btn', title }: { text: string; label: string; className?: string; title?: string }): React.ReactElement {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 1800)
    return () => clearTimeout(timer)
  }, [state])
  return <button type="button" className={`${className} ac-copy${state === 'copied' ? ' done' : ''}`} {...(title ? { title } : {})} onClick={() => { copyText(text).then(() => setState('copied'), () => setState('failed')) }}>
    <span aria-live="polite">{state === 'copied' ? t("已复制") : state === 'failed' ? t("复制失败，请手动选择") : label}</span>
  </button>
}

function Spans({ spans }: { spans: readonly Inline[] }): React.ReactElement {
  return <>{spans.map((span, index) => {
    switch (span.kind) {
      case 'text': return <React.Fragment key={index}>{span.text}</React.Fragment>
      case 'break': return <br key={index} />
      case 'code': return <code key={index}>{span.text}</code>
      case 'strong': return <strong key={index}><Spans spans={span.children} /></strong>
      case 'em': return <em key={index}><Spans spans={span.children} /></em>
      case 'del': return <del key={index}><Spans spans={span.children} /></del>
      case 'link': return <a key={index} href={span.href} target="_blank" rel="noreferrer noopener" title={span.href}><Spans spans={span.children} /></a>
    }
  })}</>
}

function Blocks({ blocks }: { blocks: readonly Block[] }): React.ReactElement {
  return <>{blocks.map((block, index) => {
    switch (block.kind) {
      case 'heading': return React.createElement(`h${Math.min(6, block.level + 2)}`, { key: index }, <Spans spans={block.children} />)
      case 'paragraph': return <p key={index}><Spans spans={block.children} /></p>
      case 'rule': return <hr key={index} />
      case 'quote': return <blockquote key={index}><Blocks blocks={block.children} /></blockquote>
      case 'code': return <div key={index} className="ac-md-code">
        <div className="ac-md-code-head"><span>{block.lang || t("代码")}</span><CopyButton text={block.text} label={t("复制")} title={t("复制这段代码")} /></div>
        <pre tabIndex={0}><code>{block.text}</code></pre>
      </div>
      case 'list': return React.createElement(block.ordered ? 'ol' : 'ul', { key: index, ...(block.start !== undefined ? { start: block.start } : {}) },
        block.items.map((item, at) => <li key={at}><Blocks blocks={item} /></li>))
      case 'table': return <div key={index} className="ac-md-table" tabIndex={0}><table>
        <thead><tr>{block.head.map((cell, at) => <th key={at} style={block.align[at] ? { textAlign: block.align[at] } : undefined}><Spans spans={cell} /></th>)}</tr></thead>
        <tbody>{block.rows.map((row, at) => <tr key={at}>{row.map((cell, column) => <td key={column} style={block.align[column] ? { textAlign: block.align[column] } : undefined}><Spans spans={cell} /></td>)}</tr>)}</tbody>
      </table></div>
    }
  })}</>
}

/** An answer as the reader sees it in a chat: headings, lists, tables and code, never raw markup. */
export function Markdown({ text }: { text: string }): React.ReactElement {
  // Answers are at most a few thousand characters; reading them on each render is cheap.
  return <Blocks blocks={parseMarkdown(text)} />
}

export function ResultView({ run, c, call }: { run: Run; c: Cand; call: Call }): React.ReactElement {
  if (c.result === 'answer') {
    const answer = c.answer ?? c.summary
    return <div className="ac-result" role="region" aria-label={t("候选 {0} 的回答", { 0: c.label })}>
      <div className="ac-result-head"><b>{t("回答")}</b><span className="ac-meta">{t("这一版只给出回答，没有写文件")}</span>{answer && <CopyButton text={answer} label={t("复制回答")} title={t("复制这一版回答的原文")} />}</div>
      <div className="ac-answer ac-md" tabIndex={0}>{answer ? <Markdown text={answer} /> : t("（没有内容）")}</div>
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
    <div className="ac-result-head"><b>{t("写出的文件")}</b><span className="ac-meta">{t("{0} 个文件 · 没有可以直接打开的页面", { 0: files.length })}</span>{content?.text !== undefined && !content.truncated && <CopyButton text={content.text} label={t("复制文件内容")} title={t("复制当前打开的文件")} />}</div>
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
    return <div className="ac-enable-git confirm" role="group" aria-label={t("在此目录启用 Git")}>
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
