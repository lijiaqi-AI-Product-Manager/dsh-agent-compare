import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RunStore } from '../core/run-store.js';
export function defaultPreferences(minutes = 30) {
    return { enabled: false, mode: 'same-model', generationMinutes: minutes, models: [{}, {}] };
}
export function parsePreferences(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('比较设置格式无效');
    const p = value;
    if (typeof p.enabled !== 'boolean' || !['same-model', 'cross-model'].includes(String(p.mode)))
        throw new Error('比较方式无效');
    if (typeof p.generationMinutes !== 'number' || !Number.isFinite(p.generationMinutes) || p.generationMinutes < 5 || p.generationMinutes > 120)
        throw new Error('每版生成上限需要在 5 到 120 分钟之间');
    if (p.exampleKind !== undefined && p.exampleKind !== 'quick' && p.exampleKind !== 'full')
        throw new Error('示例类型无效');
    if (p.windowsProcessCompat !== undefined && p.windowsProcessCompat !== 'auto' && p.windowsProcessCompat !== 'off')
        throw new Error('Windows 进程兼容设置无效');
    if (!Array.isArray(p.models) || p.models.length !== 2)
        throw new Error('模型设置需要两个位置');
    const models = p.models.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('模型设置无效');
        const r = value;
        if (r.provider === undefined && r.model === undefined)
            return {};
        if (typeof r.provider !== 'string' || !r.provider.trim() || typeof r.model !== 'string' || !r.model.trim())
            throw new Error('请选择包含服务与模型的完整配置');
        return { provider: r.provider, model: r.model };
    });
    return { enabled: p.enabled, mode: p.mode, generationMinutes: p.generationMinutes, models, ...(p.exampleKind === undefined ? {} : { exampleKind: p.exampleKind }), ...(p.windowsProcessCompat === undefined ? {} : { windowsProcessCompat: p.windowsProcessCompat }) };
}
export class PreferencesStore {
    store;
    defaults;
    constructor(store, defaults = defaultPreferences()) {
        this.store = store;
        this.defaults = defaults;
    }
    key(sessionId) { return createHash('sha256').update(sessionId).digest('hex').slice(0, 32); }
    file(sessionId) { return path.join(this.store.home, 'preferences', `${this.key(sessionId)}.json`); }
    async load(sessionId) {
        // A navigation can overlap the previous page's final save. Use the same
        // session lock so a new view cannot restore an older optimistic setting.
        return this.store.withLock(`preferences-${this.key(sessionId)}`, () => this.read(sessionId), { waitMs: 5000 });
    }
    async read(sessionId) {
        let text;
        try {
            text = await readFile(this.file(sessionId), 'utf8');
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return this.defaults;
            throw e;
        }
        const data = JSON.parse(text);
        if (data.version !== 1)
            throw new Error('比较设置版本无效，请重置设置');
        return parsePreferences(data.preferences);
    }
    async save(sessionId, value) {
        const preferences = parsePreferences(value);
        return this.store.withLock(`preferences-${this.key(sessionId)}`, async () => {
            const file = this.file(sessionId);
            await mkdir(path.dirname(file), { recursive: true });
            const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
            try {
                await writeFile(temporary, JSON.stringify({ version: 1, preferences }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
                for (let attempt = 0;; attempt++) {
                    try {
                        await rename(temporary, file);
                        break;
                    }
                    catch (error) {
                        if (attempt >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code ?? ''))
                            throw error;
                        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
                    }
                }
                return preferences;
            }
            finally {
                await unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                    throw error; });
            }
        }, { waitMs: 5000 });
    }
}
/** UI submissions carry frozen settings without asking users to write flags. */
export function parseUiSubmission(raw) {
    const text = raw.trim();
    if (!text.startsWith('@ui '))
        return undefined;
    const value = JSON.parse(text.slice(4));
    if (value.version !== 1 || typeof value.task !== 'string' || typeof value.example !== 'boolean')
        throw new Error('比较任务格式无效');
    return { task: value.task, example: value.example, preferences: parsePreferences(value.preferences) };
}
