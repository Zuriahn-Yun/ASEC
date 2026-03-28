import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ToolStatus {
  name: string;
  available: boolean;
  version?: string;
}

async function checkTool(name: string): Promise<ToolStatus> {
  try {
    // Use shell: true so Windows .cmd scripts (e.g. npm.cmd) are resolved
    const { stdout, stderr } = await execFileAsync(name, ['--version'], { timeout: 5000, shell: true });
    // Some tools (e.g. nuclei) print version to stderr; strip ANSI codes
    const output = stdout.trim() || stderr.trim();
    const version = output.split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '').trim();

    // For docker, also verify the daemon is running
    if (name === 'docker') {
      try {
        await execFileAsync('docker', ['info'], { timeout: 5000, shell: true });
      } catch {
        return { name, available: true, version: version + ' (daemon not running)' };
      }
    }

    return { name, available: true, version };
  } catch {
    return { name, available: false };
  }
}

export async function checkTools(): Promise<ToolStatus[]> {
  const tools = ['git', 'semgrep', 'docker', 'nuclei', 'trivy', 'npm'];
  return Promise.all(tools.map(t => checkTool(t)));
}
