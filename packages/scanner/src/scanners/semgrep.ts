import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ScanFinding } from '../../../shared/types/index.js';

const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';

const SEMGREP_TIMEOUT_MS = 10 * 60 * 1000;
const SEMGREP_EXCLUDES = ['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'out', 'vendor'];

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
  const start = Date.now();
  const stdout = await runLocalSemgrep(repoDir) ?? await runDockerSemgrep(repoDir);
  if (!stdout) {
    console.log('[SAST] Semgrep produced no output');
    return [];
  }

  let sarif: SarifOutput;
  try {
    sarif = JSON.parse(stdout) as SarifOutput;
  } catch {
    console.error('[SAST] Failed to parse Semgrep SARIF output');
    return [];
  }

  const results: SarifResult[] = sarif.runs?.[0]?.results ?? [];
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[SAST] Semgrep found ${results.length} findings in ${elapsed}s`);

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
    console.log('[SAST] Trying local Semgrep...');
    const result = await execFileAsync(
      'semgrep',
      buildSemgrepArgs(repoDir),
      { maxBuffer: 50 * 1024 * 1024, timeout: SEMGREP_TIMEOUT_MS, shell: USE_SHELL },
    );
    return result.stdout;
  } catch (error) {
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
    console.log('[SAST] Local Semgrep not available, falling back to Docker');
  }

  return null;
}

async function runDockerSemgrep(repoDir: string): Promise<string | null> {
  try {
    await execFileAsync('docker', ['--version']);
  } catch {
    console.warn('[SAST] Semgrep is unavailable and Docker is not installed.');
    return null;
  }

  try {
    console.log('[SAST] Running Semgrep via Docker (this may take a few minutes)...');
    const { stdout } = await execFileAsync(
      'docker',
      ['run', '--rm', '-v', `${repoDir}:/src`, 'returntocorp/semgrep', 'semgrep', ...buildSemgrepArgs('/src')],
      { timeout: SEMGREP_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
    );
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

function buildSemgrepArgs(target: string): string[] {
  // Use p/javascript (broad, high-signal, no auth required in OSS) +
  // p/secrets to catch credential leaks. Keeping to 2 rulesets avoids
  // multi-ruleset fan-out that turns a 10-minute scan into a 60-minute one.
  const configs = [
    'p/javascript',
    'p/secrets',
  ];
  return [
    'scan',
    ...configs.flatMap((cfg) => ['--config', cfg]),
    '--sarif',
    '--quiet',
    // Force OSS-only mode — prevents Pro rule authentication prompts that
    // can stall the scan indefinitely in CI/unattended environments.
    '--oss-only',
    // Skip large generated/vendored files to keep scan time under 5 min
    '--max-target-bytes', '500000',
    // Use all available CPUs for parallel rule evaluation
    '--jobs', '4',
    ...SEMGREP_EXCLUDES.flatMap((dir) => ['--exclude', dir]),
    target,
  ];
}
