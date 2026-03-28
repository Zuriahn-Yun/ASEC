import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
async function checkTool(name) {
    try {
        // Use shell: true so Windows .cmd scripts (e.g. npm.cmd) are resolved
        const { stdout, stderr } = await execFileAsync(name, ['--version'], { timeout: 5000, shell: true });
        // Some tools (e.g. nuclei) print version to stderr; strip ANSI codes
        const output = stdout.trim() || stderr.trim();
        const version = output.split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '').trim();
        // For docker, also verify the daemon is running
        if (name === 'docker') {
            try {
                await execAsync('docker info --format "{{.ServerVersion}}"', { timeout: 5000 });
            }
            catch {
                return { name, available: true, version: version + ' (daemon not running)' };
            }
        }
        return { name, available: true, version };
    }
    catch {
        return { name, available: false };
    }
}
export async function checkTools() {
    const tools = ['git', 'semgrep', 'docker', 'nuclei', 'trivy', 'npm'];
    const results = await Promise.all(tools.map(t => checkTool(t)));
    const dockerStatus = results.find((tool) => tool.name === 'docker');
    return results.map((tool) => {
        if ((tool.name === 'semgrep' || tool.name === 'trivy' || tool.name === 'nuclei') && !tool.available && dockerStatus?.available) {
            return { name: tool.name, available: true, version: 'via Docker image' };
        }
        return tool;
    });
}
