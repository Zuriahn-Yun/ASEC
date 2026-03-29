import { exec } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
export async function runNpm(args, options) {
    const command = buildNpmCommand(args);
    return execAsync(command, {
        cwd: options.cwd,
        timeout: options.timeout,
        maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    });
}
export function getNpmExecutable() {
    if (process.platform === 'win32') {
        return join(dirname(process.execPath), 'npm.cmd');
    }
    return 'npm';
}
function buildNpmCommand(args) {
    const executable = quote(getNpmExecutable());
    const renderedArgs = args.map(quote).join(' ');
    return renderedArgs ? `${executable} ${renderedArgs}` : executable;
}
function quote(value) {
    if (!/[\s"]/u.test(value)) {
        return value;
    }
    return `"${value.replace(/"/g, '\\"')}"`;
}
