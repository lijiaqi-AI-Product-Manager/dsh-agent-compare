import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { isNumericPreviewHost } from '../core/preview-url.js';
import { BusyError } from '../core/run-store.js';
import { HttpError } from './request.js';
const execute = promisify(execFile);
const MAX_ENTRIES = 16_384;
const MAX_BYTES = 4 * 1024 * 1024;
const POOL_SIZE = 64;
/** The privileged payload contains only fixed tools and validated numeric addresses.
 * It never removes an existing address or writes a permanent system file. */
export function previewAliasCommand(addresses) {
    if (!addresses.length || addresses.length > POOL_SIZE || new Set(addresses).size !== addresses.length || !addresses.every(isNumericPreviewHost))
        throw new Error('Invalid dedicated preview addresses');
    return addresses.map(address => `if /sbin/ifconfig lo0 | /usr/bin/awk '$1 == "inet" {print $2}' | /usr/bin/grep -Fqx '${address}'; then /usr/bin/printf 'existing:${address}\\n'; elif /sbin/ifconfig lo0 alias '${address}' 255.255.255.255; then /usr/bin/printf 'created:${address}\\n'; else /usr/bin/printf 'failed:${address}\\n'; fi`).join('\n');
}
export function previewAliasScript(addresses) {
    const quoted = JSON.stringify(previewAliasCommand(addresses));
    return `do shell script ${quoted} with administrator privileges`;
}
/** Do not expose the privileged command text in a browser error. */
export function previewNetworkFailure(error) {
    const value = error;
    if (/(?:-128\b|user cancel(?:led|ed)|用户(?:已)?取消)/i.test(`${value?.stderr ?? ''}\n${value?.message ?? ''}`))
        return new HttpError(409, '已取消系统授权；未启动比较，需求和历史记录保留。', 'preview-network-cancelled');
    if (value?.code === 'ETIMEDOUT' || value?.killed)
        return new HttpError(504, '系统授权或地址配置超时；请重新检查预览环境，确认后再试。', 'preview-network-timeout');
    return new HttpError(500, '本机预览地址配置失败；请重新检查预览环境。原记录已保留。', 'preview-network-failed');
}
function systemEnvironment() {
    return { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: os.homedir(), LANG: 'en_US.UTF-8' };
}
const defaultSystem = {
    async addresses(signal) {
        const { stdout } = await execute('/sbin/ifconfig', ['lo0'], { encoding: 'utf8', timeout: 5000, maxBuffer: MAX_BYTES, env: systemEnvironment(), ...(signal ? { signal } : {}) });
        return new Set([...stdout.matchAll(/^\s*inet\s+(\d+\.\d+\.\d+\.\d+)\s/gm)].map(match => match[1]));
    },
    async provision(addresses, signal) {
        try {
            const { stdout } = await execute('/usr/bin/osascript', ['-e', previewAliasScript(addresses)], { encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024, env: systemEnvironment(), ...(signal ? { signal } : {}) });
            return stdout;
        }
        catch (error) {
            signal?.throwIfAborted();
            throw previewNetworkFailure(error);
        }
    },
};
/** Journal and assignment live outside executable project copies. Configured
 * addresses are never reassigned, including after a preview or host stops. */
export class PreviewNetwork {
    store;
    system;
    platform;
    configuring = false;
    file;
    constructor(store, system = defaultSystem, platform = process.platform) {
        this.store = store;
        this.system = system;
        this.platform = platform;
        this.file = path.join(store.home, 'preview-network.json');
    }
    async read() {
        let before;
        try {
            before = await lstat(this.file);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return { schema: 'agent-compare.preview-network/v1', enabled: false, entries: [] };
            throw error;
        }
        if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_BYTES)
            throw new Error('本机预览地址记录无法安全读取；原文件已保留');
        const handle = await open(this.file, 'r');
        let value;
        try {
            const observed = await handle.stat();
            if (observed.ino !== before.ino || observed.dev !== before.dev || observed.size > MAX_BYTES)
                throw new Error('本机预览地址记录在读取时变化，请重试');
            const chunks = [];
            let size = 0;
            for (;;) {
                const chunk = Buffer.allocUnsafe(65_536);
                const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
                if (!bytesRead)
                    break;
                size += bytesRead;
                if (size > MAX_BYTES)
                    throw new Error('本机预览地址记录超过读取限制');
                chunks.push(chunk.subarray(0, bytesRead));
            }
            const after = await handle.stat();
            if (after.size !== observed.size || after.mtimeMs !== observed.mtimeMs || after.ctimeMs !== observed.ctimeMs)
                throw new Error('本机预览地址记录在读取时变化，请重试');
            value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
        }
        finally {
            await handle.close();
        }
        const ledger = value;
        if (!ledger || ledger.schema !== 'agent-compare.preview-network/v1' || typeof ledger.enabled !== 'boolean' || !Array.isArray(ledger.entries) || ledger.entries.length > MAX_ENTRIES)
            throw new Error('本机预览地址记录格式无效；不会重置或覆盖');
        const seen = new Set();
        for (const entry of ledger.entries) {
            if (!entry || !isNumericPreviewHost(entry.address) || seen.has(entry.address) || !['planned', 'configured', 'unconfirmed'].includes(entry.state) || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0
                || (entry.usedBy !== undefined && !/^[a-f0-9]{8}:[ABR]$/.test(entry.usedBy)) || (entry.usedAt !== undefined && (!Number.isSafeInteger(entry.usedAt) || entry.usedAt < 0)))
                throw new Error('本机预览地址记录包含无效条目；不会重置或覆盖');
            seen.add(entry.address);
        }
        return ledger;
    }
    async write(ledger) {
        const bytes = JSON.stringify(ledger);
        if (Buffer.byteLength(bytes) > MAX_BYTES)
            throw new Error('本机预览地址记录已达到容量限制');
        await mkdir(this.store.home, { recursive: true });
        const temporary = `${this.file}.${randomBytes(8).toString('hex')}.tmp`;
        const handle = await open(temporary, 'wx', 0o600);
        try {
            try {
                await handle.writeFile(bytes, 'utf8');
                await handle.sync();
            }
            finally {
                await handle.close();
            }
            await rename(temporary, this.file);
        }
        finally {
            await unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                throw error; });
        }
    }
    async status(signal) {
        const empty = { platform: this.platform, available: 0, configured: 0, used: 0, unconfirmed: 0 };
        if (this.platform !== 'darwin')
            return { ...empty, state: 'not-required' };
        try {
            const ledger = await this.read(), present = await this.system.addresses(signal);
            const available = ledger.entries.filter(entry => entry.state === 'configured' && !entry.usedBy && present.has(entry.address)).length;
            return { ...empty, state: this.configuring ? 'configuring' : available >= 2 ? 'ready' : 'needs-setup', available,
                configured: ledger.entries.filter(entry => entry.state === 'configured' && present.has(entry.address)).length,
                used: ledger.entries.filter(entry => entry.usedBy).length,
                unconfirmed: ledger.entries.filter(entry => entry.state !== 'configured').length };
        }
        catch (error) {
            return { ...empty, state: 'unavailable', diagnostic: error.message };
        }
    }
    async enable(confirmed, signal) {
        if (this.platform !== 'darwin')
            throw new HttpError(400, '当前系统不需要配置 Safari 本机预览地址');
        if (confirmed !== true)
            throw new HttpError(400, '请先确认本机地址配置，再请求系统授权');
        signal?.throwIfAborted();
        if (this.configuring)
            throw new BusyError('本机预览地址正在配置，请稍后重新检查');
        this.configuring = true;
        try {
            await this.store.withLock('preview-network', async () => {
                const ledger = await this.read(), present = await this.system.addresses(signal);
                if (ledger.entries.filter(entry => entry.state === 'configured' && !entry.usedBy && present.has(entry.address)).length >= 2)
                    return;
                if (ledger.entries.length + POOL_SIZE > MAX_ENTRIES)
                    throw new Error('本机预览地址记录已达到容量限制；原记录已保留');
                const excluded = new Set([...present, ...ledger.entries.map(entry => entry.address)]), addresses = [];
                while (addresses.length < POOL_SIZE) {
                    const bytes = randomBytes(3), address = `127.${64 + (bytes[0] & 63)}.${bytes[1]}.${1 + (bytes[2] % 254)}`;
                    if (!excluded.has(address)) {
                        excluded.add(address);
                        addresses.push(address);
                    }
                }
                const entries = addresses.map(address => ({ address, state: 'planned', createdAt: Date.now() }));
                ledger.entries.push(...entries);
                await this.write(ledger);
                signal?.throwIfAborted();
                let output = '';
                try {
                    output = await this.system.provision(addresses, signal);
                }
                finally {
                    const created = new Set(output.split(/[\r\n]+/).map(line => /^created:(127\.[\d.]+)$/.exec(line.trim())?.[1]).filter((address) => address !== undefined && addresses.includes(address)));
                    const after = await this.system.addresses().catch(() => new Set());
                    for (const entry of entries)
                        entry.state = created.has(entry.address) && after.has(entry.address) ? 'configured' : 'unconfirmed';
                    if (entries.some(entry => entry.state === 'configured'))
                        ledger.enabled = true;
                    await this.write(ledger);
                }
                signal?.throwIfAborted();
                if (entries.filter(entry => entry.state === 'configured').length < 2)
                    throw new Error('未能确认足够的本机预览地址；已有系统地址和原始记录已保留');
            }, { waitMs: 5000, busyMessage: '本机预览地址正在配置，请稍后重新检查' });
        }
        finally {
            this.configuring = false;
        }
        return this.status(signal);
    }
    async allocate(owner, signal) {
        signal.throwIfAborted();
        if (this.platform !== 'darwin')
            return undefined;
        if (!/^[a-f0-9]{8}$/.test(owner.runId) || !/^[ABR]$/.test(owner.label))
            throw new Error('本机预览地址缺少有效的运行归属');
        return this.store.withLock('preview-network', async () => {
            signal.throwIfAborted();
            const ledger = await this.read();
            if (!ledger.enabled)
                return undefined;
            const present = await this.system.addresses(signal);
            const entry = ledger.entries.find(entry => entry.state === 'configured' && !entry.usedBy && present.has(entry.address));
            if (!entry)
                throw new Error('可用的本机预览地址不足或已随系统重启释放，请重新启用 Safari 实时比较');
            entry.usedBy = `${owner.runId}:${owner.label}`;
            entry.usedAt = Date.now();
            await this.write(ledger);
            return entry.address;
        }, { waitMs: 5000, busyMessage: '本机预览地址正在配置，请稍后重新检查' });
    }
}
