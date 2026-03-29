import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ScanFinding, SeverityLevel } from '../../../shared/types';

const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
const TRIVY_TIMEOUT_MS = 90_000;
const TRIVY_SKIP_DIRS = ['.git', '.next', 'build', 'coverage', 'dist', 'out', 'vendor'];

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
  console.log(`[SCA] Running Trivy against ${repoDir}...`);
  const start = Date.now();
  const stdout = await runLocalTrivy(repoDir) ?? await runDockerTrivy(repoDir);
  if (!stdout) {
    console.log('[SCA] Trivy produced no output');
    return [];
  }

  let report: SarifReport;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error('[SCA] Failed to parse Trivy SARIF output');
    return [];
  }

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

  console.log(`[SCA] Trivy found ${findings.length} findings in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return findings;
}

async function runLocalTrivy(repoDir: string): Promise<string | null> {
  try {
    console.log('[SCA] Trying local Trivy...');
    const { stdout } = await execFileAsync('trivy', buildTrivyArgs(repoDir, true), {
      timeout: TRIVY_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
      shell: USE_SHELL,
    });
    return stdout;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
    console.warn('[SCA] Local Trivy failed:', execError.message || error);
  }

  return null;
}

async function runDockerTrivy(repoDir: string): Promise<string | null> {
  try {
    await execFileAsync('docker', ['--version']);
  } catch {
    console.warn('[SCA] Trivy is unavailable and Docker is not installed.');
    return null;
  }

  try {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${repoDir}:/repo:ro`,
        'ghcr.io/aquasecurity/trivy:latest',
        ...buildTrivyArgs('/repo', false),
      ],
      {
        timeout: TRIVY_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024,
      },
    );
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

function buildTrivyArgs(target: string, skipDbUpdate: boolean): string[] {
  const args = [
    'fs',
    '--format',
    'sarif',
    '--quiet',
    '--timeout',
    '120s',
    ...TRIVY_SKIP_DIRS.flatMap((dir) => ['--skip-dirs', `${target}/${dir}`]),
  ];

  if (skipDbUpdate) {
    args.push('--skip-db-update');
  }

  args.push(target);
  return args;
}
