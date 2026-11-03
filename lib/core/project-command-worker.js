/**
 * Windows command shims need a command interpreter. Launch it only AFTER this
 * trusted Node entry has entered the host's confinement, so the wrapped argv
 * is an executable invocation rather than an ambiguous shell string.
 */
import { spawn } from 'node:child_process';
import { spawnSpec } from './proc.js';
const spec = spawnSpec(process.argv.slice(2));
const child = spawn(spec.file, spec.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: spec.shell,
    windowsHide: true,
    stdio: 'inherit',
});
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('close', (code) => { process.exitCode = code ?? 1; });
