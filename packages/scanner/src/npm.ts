import { exec } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface RunNpmOptions {
  cwd: string;
  timeout: number;
  maxBuffer?: number;
}

export async function runNpm(
  args: string[],
  options: RunNpmOptions,
): Promise<{ stdout: string; stderr: string }> {
  const command = buildNpmCommand(args);
  return execAsync(command, {
    cwd: options.cwd,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
  });
}

export function getNpmExecutable(): string {
  if (process.platform === 'win32') {
    return join(dirname(process.execPath), 'npm.cmd');
  }

  return 'npm';
}

function buildNpmCommand(args: string[]): string {
  const executable = quote(getNpmExecutable());
  const renderedArgs = args.map(quote).join(' ');
  return renderedArgs ? `${executable} ${renderedArgs}` : executable;
}

function quote(value: string): string {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}
