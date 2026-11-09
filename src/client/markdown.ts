/**
 * A small Markdown reader for answers shown in a candidate card.
 *
 * Answers are written by models in Markdown. Showing the raw text leaves
 * `**`, `#` and table pipes in the way of reading. This reader turns the
 * common block and inline forms into a plain tree that the card renders as
 * React elements, so no markup from an answer ever reaches the page as HTML.
 * Single line breaks inside a paragraph are kept, as in chat replies.
 * Links are kept only for http, https and mailto addresses.
 */

export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'strong' | 'em' | 'del'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly Inline[] }
  | { readonly kind: 'break' }

export type Align = 'left' | 'center' | 'right' | undefined

export type Block =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly children: readonly Inline[] }
  | { readonly kind: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly kind: 'code'; readonly lang?: string; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly start?: number; readonly items: readonly (readonly Block[])[] }
  | { readonly kind: 'quote'; readonly children: readonly Block[] }
  | { readonly kind: 'table'; readonly align: readonly Align[]; readonly head: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly kind: 'rule' }

/** Nesting deeper than this is read as plain text, so a hostile answer cannot exhaust the stack. */
const MAX_DEPTH = 8

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const QUOTE = /^ {0,3}> ?/
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/
const TABLE_SEPARATOR = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

const blank = (line: string): boolean => line.trim() === ''

export function parseMarkdown(source: string): Block[] {
  return blocks(source.replace(/\r\n?/g, '\n').split('\n'), 0)
}

function startsBlock(line: string, next: string | undefined): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line) || (line.includes('|') && next !== undefined && TABLE_SEPARATOR.test(next) && next.includes('-'))
}

function blocks(lines: string[], depth: number): Block[] {
  if (depth > MAX_DEPTH) return lines.some(line => !blank(line)) ? [{ kind: 'paragraph', children: [{ kind: 'text', text: lines.join('\n').trim() }] }] : []
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (blank(line)) { i++; continue }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]!
      const indent = line.length - line.trimStart().length
      const body: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`).test(lines[i]!)) {
        body.push(lines[i]!.slice(Math.min(indent, lines[i]!.length - lines[i]!.trimStart().length)))
        i++
      }
      i++
      out.push({ kind: 'code', ...(fence[2] ? { lang: fence[2] } : {}), text: body.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      out.push({ kind: 'heading', level: heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, children: inline(heading[2] ?? '', depth) })
      i++
      continue
    }

    if (RULE.test(line)) { out.push({ kind: 'rule' }); i++; continue }

    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && !blank(lines[i]!) && (QUOTE.test(lines[i]!) || !startsBlock(lines[i]!, lines[i + 1]))) {
        body.push(lines[i]!.replace(QUOTE, ''))
        i++
      }
      out.push({ kind: 'quote', children: blocks(body, depth + 1) })
      continue
    }

    const next = lines[i + 1]
    if (line.includes('|') && next !== undefined && TABLE_SEPARATOR.test(next) && next.includes('-')) {
      const head = cells(line)
      const align = cells(next).map((cell): Align => {
        const left = cell.startsWith(':'), right = cell.endsWith(':')
        return left && right ? 'center' : right ? 'right' : left ? 'left' : undefined
      })
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && !blank(lines[i]!) && lines[i]!.includes('|')) {
        const row = cells(lines[i]!)
        rows.push(head.map((_, column) => inline(row[column] ?? '', depth)))
        i++
      }
      out.push({ kind: 'table', align: head.map((_, column) => align[column]), head: head.map(cell => inline(cell, depth)), rows })
      continue
    }

    const item = ITEM.exec(line)
    if (item) {
      const ordered = /\d/.test(item[2]!)
      const delimiter = item[2]!.slice(-1)
      const items: Block[][] = []
      const start = ordered ? Number.parseInt(item[2]!, 10) : undefined
      while (i < lines.length) {
        const current = ITEM.exec(lines[i]!)
        if (!current || /\d/.test(current[2]!) !== ordered || current[2]!.slice(-1) !== delimiter) break
        const contentIndent = current[1]!.length + current[2]!.length + Math.max(1, Math.min(4, current[3]!.length))
        const body = [current[4]!]
        i++
        while (i < lines.length) {
          const following = lines[i]!
          if (blank(following)) {
            // A blank line continues the item only when indented content follows it.
            let ahead = i + 1
            while (ahead < lines.length && blank(lines[ahead]!)) ahead++
            if (ahead < lines.length && leading(lines[ahead]!) >= contentIndent) { body.push(...lines.slice(i, ahead).map(() => '')); i = ahead; continue }
            break
          }
          if (leading(following) >= contentIndent) { body.push(dedent(following, contentIndent)); i++; continue }
          if (ITEM.test(following) || startsBlock(following, lines[i + 1])) break
          body.push(following.trim()); i++
        }
        items.push(blocks(body, depth + 1))
        while (i < lines.length && blank(lines[i]!)) {
          let ahead = i
          while (ahead < lines.length && blank(lines[ahead]!)) ahead++
          const again = ahead < lines.length ? ITEM.exec(lines[ahead]!) : null
          if (again && /\d/.test(again[2]!) === ordered && again[2]!.slice(-1) === delimiter && again[1]!.length === item[1]!.length) i = ahead
          else break
        }
      }
      out.push({ kind: 'list', ordered, ...(start !== undefined && start !== 1 ? { start } : {}), items })
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length && !blank(lines[i]!) && (paragraph.length === 0 || !startsBlock(lines[i]!, lines[i + 1]))) {
      paragraph.push(lines[i]!.trim())
      i++
    }
    out.push({ kind: 'paragraph', children: inline(paragraph.join('\n'), depth) })
  }
  return out
}

function leading(line: string): number {
  let width = 0
  for (const char of line) {
    if (char === ' ') width++
    else if (char === '\t') width += 4 - (width % 4)
    else break
  }
  return width
}

function dedent(line: string, width: number): string {
  let column = 0, at = 0
  while (at < line.length && column < width) {
    if (line[at] === ' ') column++
    else if (line[at] === '\t') column += 4 - (column % 4)
    else break
    at++
  }
  return line.slice(at)
}

function cells(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)
  const out: string[] = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '|') { current += '|'; i++; continue }
    if (text[i] === '|') { out.push(current.trim()); current = ''; continue }
    current += text[i]
  }
  out.push(current.trim())
  return out
}

const PUNCTUATION = /[!-/:-@[-`{-~]/
const WORD = /[\p{L}\p{N}]/u

function safeHref(raw: string): string | undefined {
  const href = raw.trim().replace(/^<|>$/g, '')
  try {
    const url = new URL(href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

/** Inline spans: code, emphasis, strong, strike-through, links and line breaks. Anything else is text. */
export function inline(source: string, depth = 0): Inline[] {
  if (depth > MAX_DEPTH) return source ? [{ kind: 'text', text: source }] : []
  const out: Inline[] = []
  let text = ''
  const flush = (): void => { if (text) { out.push({ kind: 'text', text }); text = '' } }
  let i = 0
  while (i < source.length) {
    const char = source[i]!
    if (char === '\\' && i + 1 < source.length && PUNCTUATION.test(source[i + 1]!)) { text += source[i + 1]; i += 2; continue }
    if (char === '\n') { flush(); out.push({ kind: 'break' }); i++; continue }
    if (char === '`') {
      let run = 1
      while (source[i + run] === '`') run++
      const close = source.indexOf('`'.repeat(run), i + run)
      if (close !== -1 && source[close + run] !== '`') {
        flush()
        const code = source.slice(i + run, close).replace(/\n/g, ' ')
        out.push({ kind: 'code', text: code.length > 2 && code.startsWith(' ') && code.endsWith(' ') ? code.slice(1, -1) : code })
        i = close + run
        continue
      }
      text += '`'.repeat(run); i += run; continue
    }
    if (char === '[') {
      const close = matchingBracket(source, i)
      if (close !== -1 && source[close + 1] === '(') {
        const end = destinationEnd(source, close + 2)
        const href = end === -1 ? undefined : safeHref(source.slice(close + 2, end).split(/\s+"/)[0]!)
        if (end !== -1) {
          flush()
          const label = inline(source.slice(i + 1, close), depth + 1)
          if (href) out.push({ kind: 'link', href, children: label })
          else out.push(...label)
          i = end + 1
          continue
        }
      }
    }
    const pair = source.startsWith('**', i) ? '**' : source.startsWith('__', i) ? '__' : source.startsWith('~~', i) ? '~~' : undefined
    if (pair) {
      const close = closing(source, i + 2, pair)
      if (close !== -1 && opens(source, i, pair.length) && (pair !== '__' || boundary(source, i, close + 2))) {
        flush()
        out.push({ kind: pair === '~~' ? 'del' : 'strong', children: inline(source.slice(i + 2, close), depth + 1) })
        i = close + 2
        continue
      }
    }
    if ((char === '*' || char === '_') && source[i + 1] !== char) {
      const close = closing(source, i + 1, char)
      if (close !== -1 && opens(source, i, 1) && (char !== '_' || boundary(source, i, close + 1))) {
        flush()
        out.push({ kind: 'em', children: inline(source.slice(i + 1, close), depth + 1) })
        i = close + 1
        continue
      }
    }
    text += char
    i++
  }
  flush()
  return out
}

/** An opening delimiter is followed by text, not by a space. */
function opens(source: string, at: number, width: number): boolean {
  const after = source[at + width]
  return after !== undefined && !/\s/.test(after)
}

/** Underscores inside a word (`snake_case`) are not emphasis. */
function boundary(source: string, start: number, end: number): boolean {
  const before = source[start - 1], after = source[end]
  return !(before && WORD.test(before)) && !(after && WORD.test(after))
}

function closing(source: string, from: number, delimiter: string): number {
  for (let at = source.indexOf(delimiter, from); at !== -1; at = source.indexOf(delimiter, at + 1)) {
    if (at === from) continue
    if (source[at - 1] === '\\' || /\s/.test(source[at - 1]!)) continue
    if (delimiter.length === 1 && source[at + 1] === delimiter) { at++; continue }
    if (source.slice(from, at).includes('\n\n')) return -1
    return at
  }
  return -1
}

/** The `)` that ends a link destination starting at `from`; parentheses inside it must balance. */
function destinationEnd(source: string, from: number): number {
  let depth = 0
  for (let at = from; at < source.length; at++) {
    const char = source[at]
    if (char === '\\') { at++; continue }
    if (char === '\n') return -1
    if (char === '(') depth++
    else if (char === ')' && depth-- === 0) return at
  }
  return -1
}

function matchingBracket(source: string, open: number): number {
  let depth = 0
  for (let at = open; at < source.length; at++) {
    if (source[at] === '\\') { at++; continue }
    if (source[at] === '[') depth++
    else if (source[at] === ']' && --depth === 0) return at
    else if (source[at] === '\n' && source[at + 1] === '\n') return -1
  }
  return -1
}

/** The plain text of inline spans, for labels and copies. */
export function plainText(spans: readonly Inline[]): string {
  return spans.map(span => span.kind === 'text' || span.kind === 'code' ? span.text : span.kind === 'break' ? '\n' : plainText(span.children)).join('')
}
