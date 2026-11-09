/** Answers in candidate cards: common Markdown becomes a plain tree; nothing becomes HTML or an unsafe link. */
import { describe, expect, it } from 'vitest'
import { inline, parseMarkdown, plainText } from '../src/client/markdown.ts'

describe('answer markdown', () => {
  it('reads headings, paragraphs with kept line breaks, rules and quotes', () => {
    expect(parseMarkdown('# 乘法口诀\n\n一一得一\n一二得二\n\n---\n> 小技巧：**同一行**依次加 n')).toEqual([
      { kind: 'heading', level: 1, children: [{ kind: 'text', text: '乘法口诀' }] },
      { kind: 'paragraph', children: [{ kind: 'text', text: '一一得一' }, { kind: 'break' }, { kind: 'text', text: '一二得二' }] },
      { kind: 'rule' },
      { kind: 'quote', children: [{ kind: 'paragraph', children: [{ kind: 'text', text: '小技巧：' }, { kind: 'strong', children: [{ kind: 'text', text: '同一行' }] }, { kind: 'text', text: '依次加 n' }] }] },
    ])
  })

  it('reads fenced code verbatim, with its language', () => {
    expect(parseMarkdown('运行：\n```bash\nwc -w notes.txt # **not bold**\n\n  indented\n```\n完成')).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: '运行：' }] },
      { kind: 'code', lang: 'bash', text: 'wc -w notes.txt # **not bold**\n\n  indented' },
      { kind: 'paragraph', children: [{ kind: 'text', text: '完成' }] },
    ])
    expect(parseMarkdown('```\nnever closed')).toEqual([{ kind: 'code', text: 'never closed' }])
  })

  it('reads ordered, unordered, loose and nested lists', () => {
    const [list] = parseMarkdown('3. 第一步\n4. 第二步\n   - 细节 A\n   - 细节 B\n\n5. 第三步')
    expect(list).toMatchObject({ kind: 'list', ordered: true, start: 3 })
    expect(list?.kind === 'list' && list.items.length).toBe(3)
    expect(list?.kind === 'list' && list.items[1]).toEqual([
      { kind: 'paragraph', children: [{ kind: 'text', text: '第二步' }] },
      { kind: 'list', ordered: false, items: [[{ kind: 'paragraph', children: [{ kind: 'text', text: '细节 A' }] }], [{ kind: 'paragraph', children: [{ kind: 'text', text: '细节 B' }] }]] },
    ])
    expect(parseMarkdown('- a\n- b\n\n后文')).toEqual([
      { kind: 'list', ordered: false, items: [[{ kind: 'paragraph', children: [{ kind: 'text', text: 'a' }] }], [{ kind: 'paragraph', children: [{ kind: 'text', text: 'b' }] }]] },
      { kind: 'paragraph', children: [{ kind: 'text', text: '后文' }] },
    ])
  })

  it('reads tables with alignment, escaped pipes and short rows', () => {
    expect(parseMarkdown('| 方式 | 结果 |\n|:---|---:|\n| `a\\|b` | **快** |\n| 只有一格')).toEqual([{
      kind: 'table', align: ['left', 'right'],
      head: [[{ kind: 'text', text: '方式' }], [{ kind: 'text', text: '结果' }]],
      rows: [
        [[{ kind: 'code', text: 'a|b' }], [{ kind: 'strong', children: [{ kind: 'text', text: '快' }] }]],
        [[{ kind: 'text', text: '只有一格' }], []],
      ],
    }])
  })

  it('reads inline code, emphasis and strike-through without breaking ordinary text', () => {
    expect(inline('用 `npm test`，*很快*，~~很慢~~，__粗__')).toEqual([
      { kind: 'text', text: '用 ' }, { kind: 'code', text: 'npm test' }, { kind: 'text', text: '，' },
      { kind: 'em', children: [{ kind: 'text', text: '很快' }] }, { kind: 'text', text: '，' },
      { kind: 'del', children: [{ kind: 'text', text: '很慢' }] }, { kind: 'text', text: '，' },
      { kind: 'strong', children: [{ kind: 'text', text: '粗' }] },
    ])
    expect(plainText(inline('2 * 3 * 4 = 24, snake_case_name, 5*6, \\*literal\\*'))).toBe('2 * 3 * 4 = 24, snake_case_name, 5*6, *literal*')
    expect(inline('**unclosed')).toEqual([{ kind: 'text', text: '**unclosed' }])
  })

  it('keeps links only for web and mail addresses, and never produces markup', () => {
    expect(inline('[文档](https://example.com/a?b=1) 和 [邮件](mailto:me@example.com)')).toEqual([
      { kind: 'link', href: 'https://example.com/a?b=1', children: [{ kind: 'text', text: '文档' }] },
      { kind: 'text', text: ' 和 ' },
      { kind: 'link', href: 'mailto:me@example.com', children: [{ kind: 'text', text: '邮件' }] },
    ])
    expect(inline('[点我](javascript:alert(1)) [本地](file:///etc/passwd)')).toEqual([
      { kind: 'text', text: '点我' }, { kind: 'text', text: ' ' }, { kind: 'text', text: '本地' },
    ])
    expect(inline('[维基](https://en.wikipedia.org/wiki/Tree_(data_structure))')).toEqual([
      { kind: 'link', href: 'https://en.wikipedia.org/wiki/Tree_(data_structure)', children: [{ kind: 'text', text: '维基' }] },
    ])
    const html = parseMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>')
    expect(html).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', text: '<script>alert(1)</script>' }, { kind: 'break' }, { kind: 'text', text: '<img src=x onerror=alert(1)>' }] }])
  })

  it('stays bounded on deeply nested or very long input', () => {
    const nested = Array.from({ length: 40 }, (_, depth) => `${'  '.repeat(depth)}- level ${depth}`).join('\n')
    expect(() => parseMarkdown(nested)).not.toThrow()
    expect(() => parseMarkdown('>'.repeat(5_000) + ' deep')).not.toThrow()
    expect(() => parseMarkdown('*'.repeat(8_000))).not.toThrow()
    const started = Date.now()
    parseMarkdown(Array.from({ length: 400 }, (_, row) => `| ${row} | **${row}** | \`${row}\` |`).join('\n').replace(/^/, '| a | b | c |\n|---|---|---|\n'))
    expect(Date.now() - started).toBeLessThan(1_000)
  })
})
