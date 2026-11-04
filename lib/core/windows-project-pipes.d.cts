/** Windows esbuild compatibility using anonymous pipes under the current token. */
import cp = require('node:child_process');
declare function isEsbuildService(file: string, args: readonly string[]): boolean;
declare function isEsbuildVersion(file: string, args: readonly string[]): boolean;
declare function quoteWindowsArg(arg: string): string;
declare function captureSync(file: string, args: readonly string[], options?: cp.ExecFileSyncOptions): Buffer | string;
declare function logonSidString(bytes: Buffer): string;
declare function spawnEsbuildService(file: string, args: readonly string[], options?: cp.SpawnOptions): cp.ChildProcess;
declare function installEsbuildCompatibility(): () => void;
declare const _default: {
    isEsbuildService: typeof isEsbuildService;
    isEsbuildVersion: typeof isEsbuildVersion;
    quoteWindowsArg: typeof quoteWindowsArg;
    logonSidString: typeof logonSidString;
    captureSync: typeof captureSync;
    spawnEsbuildService: typeof spawnEsbuildService;
    installEsbuildCompatibility: typeof installEsbuildCompatibility;
};
export = _default;
