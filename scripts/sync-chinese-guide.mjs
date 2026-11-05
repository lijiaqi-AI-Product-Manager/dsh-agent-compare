import { readFile, writeFile } from 'node:fs/promises'
import { chineseGuideAlias } from './chinese-guide-alias.mjs'

const root = new URL('../', import.meta.url)
await writeFile(new URL('README.zh.md', root), chineseGuideAlias(await readFile(new URL('README.md', root), 'utf8')))
