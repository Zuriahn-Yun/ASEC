import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ScanFinding } from '../../../shared/types/index.js';

const execFileAsync = promisify(execFile);

const SEMGREP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// SARIF type stubs — only the fields we actually read
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

function mapLevel(
  level: SarifResult['level'],
): ScanFinding['severity'] {
  switch (level) {
    case 'error':   return 'high';
    case 'warning': return 'medium';
    case 'note':    return 'low';
    default:        return 'info';
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runSemgrep(
  repoDir: string,
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  let stdout: string;

  try {
    const result = await execFileAsync(
      'semgrep',
      ['scan', '--config', 'auto', '--sarif', '--quiet', repoDir],
      { maxBuffer: 50 * 1024 * 1024, timeout: SEMGREP_TIMEOUT_MS },
    );
    stdout = result.stdout;
  } catch (err: unknown) {
    // semgrep not found or timed out — return empty so pipeline continues
    const isNotFound =
      err instanceof Error &&
      (err.message.includes('ENOENT') || err.message.includes('not found'));
    if (isNotFound) {
      console.warn('[SAST] semgrep not found in PATH — skipping SAST scan. Install: pip install semgrep');
      return [];
    }
    // Non-zero exit with output is normal for semgrep when findings exist
    const execErr = err as { stdout?: string; code?: number };
    if (execErr.stdout) {
      stdout = execErr.stdout;
    } else {
      return [];
    }
  }

  let sarif: SarifOutput;
  try {
    sarif = JSON.parse(stdout) as SarifOutput;
  } catch {
    return [];
  }

  const results: SarifResult[] = sarif.runs?.[0]?.results ?? [];
  const scanId = ''; // scan_id will be filled in by the orchestrator

  return results.map((r): Omit<ScanFinding, 'id' | 'created_at'> => {
    const loc = r.locations?.[0]?.physicalLocation;
    return {
      scan_id: scanId,
      scanner: 'semgrep',
      scan_type: 'sast',
      severity: mapLevel(r.level),
      title: r.ruleId ?? 'semgrep finding',
      description: r.message?.text,
      file_path: loc?.artifactLocation?.uri,
      line_start: loc?.region?.startLine,
      line_end: loc?.region?.endLine,
      rule_id: r.ruleId,
      raw_sarif: r as Record<string, unknown>,
    };
  });
}
