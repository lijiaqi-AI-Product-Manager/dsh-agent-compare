import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RunStore } from '../core/run-store.js';
import { defaultStyleChoices, parseStyleChoice, strategyFor } from '../core/styles.js';
import { MAX_CANDIDATES, MIN_CANDIDATES } from '../core/types.js';
export const CONTEXT_TURNS = [1, 3, 6, 10];
export const DEFAULT_CONTEXT_TURNS = 3;
export function contextRequestOf(preferences, ids) {
    const saved = preferences.contextMode ?? 'recent';
    // A typed command or the model's tool call has no ticked entries: a manual selection falls back to the recent exchanges.
    const mode = saved === 'selected' && ids === undefined ? 'recent' : saved;
    return { mode, turns: preferences.contextTurns ?? DEFAULT_CONTEXT_TURNS, ...(mode === 'selected' && ids ? { ids } : {}) };
}
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
    if (p.contextMode !== undefined && p.contextMode !== 'none' && p.contextMode !== 'recent' && p.contextMode !== 'selected')
        throw new Error('主对话上下文设置无效');
    if (p.contextTurns !== undefined && !CONTEXT_TURNS.includes(p.contextTurns))
        throw new Error('主对话上下文轮数无效');
    if (!Array.isArray(p.models) || p.models.length < MIN_CANDIDATES || p.models.length > MAX_CANDIDATES)
        throw new Error(`模型设置需要 ${MIN_CANDIDATES} 到 ${MAX_CANDIDATES} 个位置`);
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
    if (p.versions !== undefined && (typeof p.versions !== 'number' || !Number.isSafeInteger(p.versions) || p.versions < MIN_CANDIDATES || p.versions > MAX_CANDIDATES))
        throw new Error(`版本数需要在 ${MIN_CANDIDATES} 到 ${MAX_CANDIDATES} 之间`);
    const versions = p.versions ?? MIN_CANDIDATES;
    let styles;
    if (p.styles !== undefined) {
        if (!Array.isArray(p.styles) || p.styles.length !== versions)
            throw new Error('每一版都需要选择一种风格');
        styles = p.styles.map(parseStyleChoice);
    }
    const crossStyle = p.crossStyle === undefined ? undefined : parseStyleChoice(p.crossStyle);
    if (p.blind !== undefined && typeof p.blind !== 'boolean')
        throw new Error('盲选设置无效');
    return {
        enabled: p.enabled, mode: p.mode, generationMinutes: p.generationMinutes, models,
        ...(p.versions === undefined ? {} : { versions }),
        ...(styles === undefined ? {} : { styles }),
        ...(crossStyle === undefined ? {} : { crossStyle }),
        ...(p.blind === undefined ? {} : { blind: p.blind }),
        ...(p.exampleKind === undefined ? {} : { exampleKind: p.exampleKind }), ...(p.windowsProcessCompat === undefined ? {} : { windowsProcessCompat: p.windowsProcessCompat }), ...(p.contextMode === undefined ? {} : { contextMode: p.contextMode }), ...(p.contextTurns === undefined ? {} : { contextTurns: p.contextTurns }),
    };
}
/**
 * The comparison the saved settings describe. Same-model: the current route
 * for every version, one style each. Cross-model: one complete, distinct
 * model per version and one shared style.
 */
export function comparisonPlan(saved, current, override = {}) {
    const mode = override.models ? 'cross-model' : override.mode ?? saved.mode;
    const versions = override.models?.length ?? override.versions ?? saved.versions ?? MIN_CANDIDATES;
    if (!Number.isSafeInteger(versions) || versions < MIN_CANDIDATES || versions > MAX_CANDIDATES)
        throw new Error(`版本数需要在 ${MIN_CANDIDATES} 到 ${MAX_CANDIDATES} 之间`);
    const blind = saved.blind !== false;
    if (mode === 'cross-model') {
        const routes = [...(override.models ?? saved.models.slice(0, versions))];
        if (routes.length !== versions || routes.some(route => !route.model || !route.provider))
            throw new Error(`请在比较设置中为 ${versions} 个版本各选一个完整的模型配置`);
        const keys = routes.map(route => `${route.provider}/${route.model}`);
        if (new Set(keys).size !== keys.length)
            throw new Error('多个模型模式需要选择互不相同的模型');
        return { mode, candidates: versions, routes, strategies: [strategyFor(saved.crossStyle ?? { id: 'balanced' })], blind };
    }
    if (!current.model)
        throw new Error('当前对话尚未选择模型，请先在输入框右下角选择模型。');
    // Saved styles describe the saved number of versions; a different count takes its own defaults.
    const styles = saved.styles?.length === versions ? saved.styles : defaultStyleChoices(versions);
    return { mode, candidates: versions, routes: styles.map(() => current), strategies: styles.map(strategyFor), blind };
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
    if (value.contextIds !== undefined && (!Array.isArray(value.contextIds) || value.contextIds.length > 200 || value.contextIds.some(id => !Number.isSafeInteger(id) || id < 0)))
        throw new Error('所选主对话消息无效');
    return { task: value.task, example: value.example, preferences: parsePreferences(value.preferences), ...(value.contextIds === undefined ? {} : { contextIds: [...new Set(value.contextIds)] }) };
}
