export interface HostCapabilities {
    ok: boolean;
    missing: string[];
    warnings: string[];
}
/** Required execution seams fail closed; attached sessions can work without restoration. */
export declare function hostCapabilities(services: {
    isolation: 'own-root' | 'shared-root';
    agents?: {
        create?: unknown;
    };
    subagents?: {
        startActivation?: unknown;
    };
    sandbox?: {
        confine?: unknown;
    };
    commands?: {
        register?: unknown;
    };
    sessionController?: {
        resolveAgent?: unknown;
    };
    scrubbedParentEnv: boolean;
}): HostCapabilities;
