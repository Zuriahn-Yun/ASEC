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
    const { stdout } = await execFileAsync(name, ['--version'], { timeout: 5000 });
    const version = stdout.trim().split('\n')[0];

    // For docker, also verify the daemon is running
    if (name === 'docker') {
      try {
        await execFileAsync('docker', ['info'], { timeout: 5000 });
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
