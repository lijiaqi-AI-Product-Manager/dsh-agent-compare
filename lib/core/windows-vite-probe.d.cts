/**
 * The Windows host cannot create piped stdio inside a confined grandchild.
 * Vite's optional `net use` path probe needs only its callback output. Keep
 * that probe confined, using inherited temporary-file handles for capture.
 * Other commands and non-Vite entry points retain their normal behaviour.
 */
import cp = require('node:child_process');
declare function isViteEntry(file: string | undefined): boolean;
declare function captureNetworkDrives(options: cp.ExecOptions, callback: (error: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void): cp.ChildProcess;
declare function installViteProbeCompatibility(): () => void;
declare const _default: {
    isViteEntry: typeof isViteEntry;
    captureNetworkDrives: typeof captureNetworkDrives;
    installViteProbeCompatibility: typeof installViteProbeCompatibility;
};
export = _default;
