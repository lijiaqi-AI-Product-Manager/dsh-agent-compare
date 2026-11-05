const slug = value => value.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-')

/** Keep the existing Chinese document URL and section links with one full guide. */
export function chineseGuideAlias(source) {
  const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '')
  const links = new Map()
  for (const match of prose.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const title = match[1].replace(/<[^>]*>/g, '').trim(), anchor = slug(match[1])
    if (!links.has(anchor)) links.set(anchor, title)
  }
  for (const match of prose.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) {
    if (!links.has(match[1])) links.set(match[1], ({ install: '安装', demo: '真实演示' })[match[1]] ?? match[1])
  }
  return '# AgentCompare 中文指南\n\n完整中文使用指南统一维护在 [README.md](README.md)。\n\n[立即安装](README.md#install) · [查看演示](README.md#demo) · [English](README.en.md)\n\n以下保留原章节入口，点击链接即可打开完整说明。\n\n' + [...links].map(([anchor, title]) => `<a id="${anchor}"></a>\n\n[${title.replace(/[[\]]/g, '')}](README.md#${encodeURIComponent(anchor)})\n`).join('\n')
}
