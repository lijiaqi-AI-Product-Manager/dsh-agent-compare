const hooks = ['esbuild-service', 'esbuild-version', 'vite-net-use'];
/** Process-reported diagnostics, never an attestation of confinement. */
export class WindowsCompatObserver {
    mode = 'unknown';
    seen = new Set();
    prepare(value) {
        if (value) {
            if (this.mode !== 'unknown' && this.mode !== value.mode)
                throw new Error('Windows 进程兼容设置在验收中发生变化，请重新验收');
            this.mode = value.mode;
        }
        let pending = '';
        return chunk => {
            if (this.mode !== 'auto')
                return;
            const lines = (pending + chunk).split('\n');
            pending = (lines.pop() ?? '').slice(-256);
            for (const line of lines) {
                const match = /^\[agent-compare\/windows-compat\] (esbuild-service|esbuild-version|vite-net-use)\r?$/.exec(line);
                if (match)
                    this.seen.add(match[1]);
            }
        };
    }
    snapshot() { return { mode: this.mode, observedHooks: hooks.filter(hook => this.seen.has(hook)) }; }
}
