import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getNpmExecutable, runNpm } from './npm.js';

const execFileAsync = promisify(execFile);

export interface ToolStatus {
  name: string;
  available: boolean;
  version?: string;
}

async function checkTool(name: string): Promise<ToolStatus> {
  const executable = resolveExecutable(name);

  try {
    const { stdout, stderr } = name === 'npm'
      ? await runNpm(['--version'], { cwd: process.cwd(), timeout: 5000 })
      : await execFileAsync(executable, ['--version'], { timeout: 5000 });
    // Some tools (e.g. nuclei) print version to stderr; strip ANSI codes
    const output = stdout.trim() || stderr.trim();
    const version = output.split('\n')[0].replace(/\x1b\[[0-9;]*m/g, '').trim();

    // For docker, also verify the daemon is running
    if (name === 'docker') {
      try {
        await execFileAsync(executable, ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 });
      } catch {
        return { name, available: true, version: version + ' (daemon not running)' };
      }
    }

    return { name, available: true, version };
  } catch {
    return { name, available: false };
  }
}

function resolveExecutable(name: string): string {
  if (process.platform === 'win32' && name === 'npm') {
    return getNpmExecutable();
  }

  return name;
}

export async function checkTools(): Promise<ToolStatus[]> {
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
