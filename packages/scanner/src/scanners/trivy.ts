import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import type { ScanFinding, SeverityLevel } from '../../../shared/types';
import { runNpm } from '../npm.js';

const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
// 5 minutes — DB refresh can take 2-3 min on first run; trivy internal timeout is 4m

const TRIVY_TIMEOUT_MS = 5 * 60 * 1000;
const TRIVY_SKIP_DIRS = ['.git', '.next', 'build', 'coverage', 'dist', 'out', 'vendor'];

/**
 * Ensures a package-lock.json exists so Trivy can scan npm dependencies.
 * Trivy's SCA engine only resolves vulnerabilities when a lock file is present.
 */
async function ensureLockfile(repoDir: string): Promise<void> {
  if (!existsSync(join(repoDir, 'package.json'))) {
    return; // Not a Node.js repo
  }

  const lockfilePath = join(repoDir, 'package-lock.json');
  const yarnLockPath = join(repoDir, 'yarn.lock');
  const pnpmLockPath = join(repoDir, 'pnpm-lock.yaml');

  if (existsSync(lockfilePath) || existsSync(yarnLockPath) || existsSync(pnpmLockPath)) {
    return; // Already has a lockfile
  }

  console.log('[SCA] No lockfile found — generating package-lock.json for Trivy SCA...');
  try {
    await runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit'], {
      cwd: repoDir,
      timeout: 120_000,
    });
    if (existsSync(lockfilePath)) {
      console.log('[SCA] Lockfile generated for Trivy');
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[SCA] Could not generate lockfile for Trivy:', msg);
  }
}

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

  // Generate lockfile if missing so Trivy can scan npm dependencies
  await ensureLockfile(repoDir);

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
    // Pass skipDbUpdate=false so Trivy refreshes an expired vulnerability DB.
    // A stale DB (past NextUpdate) may silently return no results on newer Trivy builds.
    const { stdout } = await execFileAsync('trivy', buildTrivyArgs(repoDir, false), {
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
        // skipDbUpdate=true: Docker image ships a bundled DB; skip the slow network download.
        ...buildTrivyArgs('/repo', true),
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
    // Internal trivy timeout must be less than TRIVY_TIMEOUT_MS (300s)
    // so trivy can flush SARIF before the parent process is killed.
    '--timeout',
    '4m30s',
    ...TRIVY_SKIP_DIRS.flatMap((dir) => ['--skip-dirs', `${target}/${dir}`]),
  ];

  // Skip DB update in Docker runs — the container image ships a bundled DB,
  // and attempting a network download inside the ephemeral container is slow
  // and unreliable. For local runs, allow Trivy to refresh an expired DB so
  // CVE coverage stays current.
  if (skipDbUpdate) {
    args.push('--skip-db-update');
  }

  args.push(target);
  return args;
}
