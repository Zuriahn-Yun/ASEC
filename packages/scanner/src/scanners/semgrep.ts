import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ScanFinding } from '../../../shared/types/index.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';

const SEMGREP_TIMEOUT_MS = 15 * 60 * 1000;

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: { startLine?: number; endLine?: number };
  };
}

interface SarifResult {
  ruleId?: string;
  level?: 'error' | 'warning' | 'note' | 'none';
  message?: { text?: string };
  locations?: SarifLocation[];
  properties?: Record<string, unknown>;
}

interface SarifRun {
  results?: SarifResult[];
}

interface SarifOutput {
  runs?: SarifRun[];
}

function mapLevel(level: SarifResult['level']): ScanFinding['severity'] {
  switch (level) {
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'note':
      return 'low';
    default:
      return 'info';
  }
}

export async function runSemgrep(
  repoDir: string,
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  const stdout = await runLocalSemgrep(repoDir) ?? await runDockerSemgrep(repoDir);
  if (!stdout) {
    return [];
  }

  let sarif: SarifOutput;
  try {
    sarif = JSON.parse(stdout) as SarifOutput;
  } catch {
    return [];
  }

  const results: SarifResult[] = sarif.runs?.[0]?.results ?? [];

  return results.map((result): Omit<ScanFinding, 'id' | 'created_at'> => {
    const location = result.locations?.[0]?.physicalLocation;

    return {
      scan_id: '',
      scanner: 'semgrep',
      scan_type: 'sast',
      severity: mapLevel(result.level),
      title: result.ruleId ?? 'semgrep finding',
      description: result.message?.text,
      file_path: location?.artifactLocation?.uri,
      line_start: location?.region?.startLine,
      line_end: location?.region?.endLine,
      rule_id: result.ruleId,
      raw_sarif: result as Record<string, unknown>,
    };
  });
}

async function runLocalSemgrep(repoDir: string): Promise<string | null> {
  try {
    const result = await execFileAsync(
      'semgrep',
      ['scan', '--config', 'auto', '--sarif', '--quiet', repoDir],
      { maxBuffer: 50 * 1024 * 1024, timeout: SEMGREP_TIMEOUT_MS, shell: USE_SHELL },
    );
    return result.stdout;
  } catch (error) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
  }

  return null;
}

async function runDockerSemgrep(repoDir: string): Promise<string | null> {
  try {
    await execAsync('docker --version');
  } catch {
    console.warn('[SAST] Semgrep is unavailable and Docker is not installed.');
    return null;
  }

  const command = [
    'docker run --rm',
    `-v "${repoDir}:/src"`,
    'returntocorp/semgrep',
    'semgrep scan --config auto --sarif --quiet /src',
  ].join(' ');

  try {
    const { stdout } = await execAsync(command, {
      timeout: SEMGREP_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }

    console.warn('[SAST] Dockerized Semgrep scan failed:', error);
    return null;
  }
}
