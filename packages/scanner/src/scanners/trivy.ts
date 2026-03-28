import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import type { ScanFinding, SeverityLevel } from '../../../shared/types';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';

type FindingWithoutMeta = Omit<ScanFinding, 'id' | 'created_at'>;

interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri?: string };
      region?: { startLine?: number; endLine?: number };
    };
  }>;
}

interface SarifRun {
  results?: SarifResult[];
}

interface SarifReport {
  runs?: SarifRun[];
}

function mapSarifSeverity(level?: string): SeverityLevel {
  switch (level) {
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'note':
      return 'low';
    case 'none':
      return 'info';
    default:
      return 'medium';
  }
}

export async function runTrivy(repoDir: string, scanId: string): Promise<FindingWithoutMeta[]> {
  const stdout = await runLocalTrivy(repoDir) ?? await runDockerTrivy(repoDir);
  if (!stdout) {
    return [];
  }

  const report: SarifReport = JSON.parse(stdout);
  const findings: FindingWithoutMeta[] = [];

  for (const run of report.runs ?? []) {
    for (const result of run.results ?? []) {
      const location = result.locations?.[0]?.physicalLocation;

      findings.push({
        scan_id: scanId,
        scanner: 'trivy',
        scan_type: 'sca',
        severity: mapSarifSeverity(result.level),
        title: result.message?.text ?? result.ruleId ?? 'Unknown vulnerability',
        description: result.message?.text,
        file_path: location?.artifactLocation?.uri,
        line_start: location?.region?.startLine,
        line_end: location?.region?.endLine,
        cwe_id: undefined,
        rule_id: result.ruleId,
        raw_sarif: result as Record<string, unknown>,
      });
    }
  }

  return findings;
}

async function runLocalTrivy(repoDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('trivy', ['fs', '--format', 'sarif', '--quiet', repoDir], {
      timeout: 300_000,
      maxBuffer: 50 * 1024 * 1024,
      shell: USE_SHELL,
    });
    return stdout;
  } catch (error) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
  }

  return null;
}

async function runDockerTrivy(repoDir: string): Promise<string | null> {
  try {
    await execAsync('docker --version');
  } catch {
    console.warn('[SCA] Trivy is unavailable and Docker is not installed.');
    return null;
  }

  const command = [
    'docker run --rm',
    `-v "${repoDir}:/repo:ro"`,
    'ghcr.io/aquasecurity/trivy:latest',
    'fs --format sarif --quiet /repo',
  ].join(' ');

  try {
    const { stdout } = await execAsync(command, {
      timeout: 300_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }

    console.warn('[SCA] Dockerized Trivy scan failed:', error);
    return null;
  }
}
