import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ScanFinding, SeverityLevel } from '../../../shared/types';

const execFileAsync = promisify(execFile);

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
  tool?: {
    driver?: {
      rules?: Array<{
        id?: string;
        shortDescription?: { text?: string };
        properties?: { precision?: string; tags?: string[] };
      }>;
    };
  };
}

interface SarifReport {
  runs?: SarifRun[];
}

function mapSarifSeverity(level?: string): SeverityLevel {
  switch (level) {
    case 'error': return 'high';
    case 'warning': return 'medium';
    case 'note': return 'low';
    case 'none': return 'info';
    default: return 'medium';
  }
}

export async function runTrivy(repoDir: string, scanId: string): Promise<FindingWithoutMeta[]> {
  try {
    const { stdout } = await execFileAsync('trivy', ['fs', '--format', 'sarif', '--quiet', repoDir], {
      timeout: 300_000, // 5 min
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Trivy not installed or not found -- graceful degradation
    if (message.includes('ENOENT') || message.includes('not found') || message.includes('not recognized')) {
      console.warn('[trivy] Not installed, skipping SCA scan');
      return [];
    }

    // Timeout
    if (message.includes('TIMEOUT') || message.includes('timed out')) {
      console.warn('[trivy] Scan timed out after 5 minutes');
      return [];
    }

    console.error('[trivy] Scan failed:', message);
    return [];
  }
}
