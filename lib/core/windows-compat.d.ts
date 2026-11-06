export type WindowsProcessCompatMode = 'auto' | 'off';
export type WindowsCompatHook = 'esbuild-service' | 'esbuild-version' | 'vite-net-use';
export interface WindowsCompatEvidence {
    readonly mode: WindowsProcessCompatMode | 'not-required' | 'unknown';
    readonly observedHooks: readonly WindowsCompatHook[];
}
/** Process-reported diagnostics, never an attestation of confinement. */
export declare class WindowsCompatObserver {
    private mode;
    private readonly seen;
    prepare(value?: WindowsCompatEvidence): (chunk: string) => void;
    snapshot(): WindowsCompatEvidence;
}
