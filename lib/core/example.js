import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './git.js';
/**
 * The built-in case. Its requirements are explicit and the DOM contract is
 * stated, so the example repository's `.agent-compare.json` can check that
 * both versions actually deliver them, not only that they render.
 */
export const EXAMPLE_TASK = [
    '给商品列表加上搜索框和分类筛选，手机上也要好用。',
    '要求：',
    '1. 搜索框按商品名称过滤，不区分大小写；',
    '2. 分类筛选可以和搜索同时生效；',
    '3. 有一个「清空」按钮，一次恢复显示全部商品；',
    '4. 宽度 390px 的手机屏幕上，搜索框和分类筛选都能直接使用。',
    '页面约定（验收会按这些来检查）：搜索框是 <input type="search">；每个商品卡片带 data-testid="product-card"；每个分类按钮带 aria-pressed 并显示分类名（Audio / Desk / Bags / Light）；清空按钮的文字是「清空」。',
].join('\n');
/** The template shipped in the package: `<package>/examples/vite-react-demo`. */
export function exampleTemplateDir() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples', 'vite-react-demo');
}
/**
 * Create a fresh, committed example repository under `parent` (a new folder
 * each time; nothing existing is touched) and return its path.
 */
export async function createExampleRepo(parent, template = exampleTemplateDir()) {
    if (!existsSync(path.join(template, 'package.json')))
        throw new Error(`example template not found: ${template}`);
    await mkdir(parent, { recursive: true });
    const taken = new Set(await readdir(parent));
    let n = 1;
    while (taken.has(`shop-${n}`))
        n++;
    const dir = path.join(parent, `shop-${n}`);
    const skip = (src) => path.relative(template, src).split(path.sep).some((seg) => seg === 'node_modules' || seg === 'dist');
    await cp(template, dir, { recursive: true, errorOnExist: true, filter: (src) => !skip(src) });
    // npm never ships `.gitignore` inside a package, so the published template has none.
    if (!existsSync(path.join(dir, '.gitignore')))
        await writeFile(path.join(dir, '.gitignore'), 'node_modules\ndist\n');
    await git(dir, ['init', '-q', '-b', 'main']);
    await git(dir, ['add', '-A']);
    await git(dir, ['-c', 'user.name=AgentCompare example', '-c', 'user.email=example@agent-compare.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'Example shop']);
    return dir;
}
