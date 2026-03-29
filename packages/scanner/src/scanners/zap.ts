import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type ScannerType = 'semgrep' | 'zap' | 'nuclei' | 'trivy' | 'npm_audit';
type ScanCategory = 'sast' | 'dast' | 'sca';

interface ScanFinding {
  id: string;
  scan_id: string;
  scanner: ScannerType;
  scan_type: ScanCategory;
  severity: SeverityLevel;
  title: string;
  description?: string;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  cwe_id?: string;
  rule_id?: string;
  raw_sarif?: Record<string, unknown>;
  created_at: string;
}

interface ZapSite {
  '@name': string;
  '@host': string;
  '@port': string;
  '@ssl': string;
  alerts: ZapAlert[];
}

interface ZapAlert {
  pluginid: string;
  alertRef: string;
  alert: string;
  name: string;
  riskcode: string;
  confidence: string;
  riskdesc: string;
  desc: string;
  instances?: ZapInstance[];
  count: string;
  solution?: string;
  otherinfo?: string;
  reference?: string;
  cweid?: string;
  wascid?: string;
  sourceid?: string;
}

interface ZapInstance {
  uri: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
  otherinfo?: string;
}

interface ZapReport {
  '@version': string;
  '@generated': string;
  site: ZapSite[];
}

export async function runZap(
  targetUrl: string,
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zap-'));
  const reportPath = path.join(tempDir, 'zap-report.json');

  try {
    try {
      await execFileAsync('docker', ['--version']);
    } catch {
      console.warn('[DAST] Docker is not available, skipping ZAP scan.');
      return [];
    }

    const dockerTargetUrl = getDockerReachableUrl(targetUrl);
    console.log(`[DAST] Starting ZAP baseline scan against ${dockerTargetUrl}...`);
    const start = Date.now();

    try {
      await execFileAsync('docker', [
        'run',
        '--rm',
        '--add-host=host.docker.internal:host-gateway',
        '-v',
        `${tempDir}:/zap/wrk/:rw`,
        'ghcr.io/zaproxy/zaproxy:stable',
        'zap-baseline.py',
        '-t',
        dockerTargetUrl,
        '-J',
        'zap-report.json',
        '-m',
        '5',
      ], {
        timeout: 10 * 60 * 1000,
        maxBuffer: 50 * 1024 * 1024,
      });
    } catch {
      // ZAP exits non-zero when it finds issues. We still parse the report.
      console.log(`[DAST] ZAP scan finished in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    }

    try {
      await fs.access(reportPath);
    } catch {
      console.warn('[DAST] ZAP report was not generated, returning empty result set.');
      return [];
    }

    const reportContent = await fs.readFile(reportPath, 'utf-8');
    const report: ZapReport = JSON.parse(reportContent);

    const findings: Omit<ScanFinding, 'id' | 'created_at'>[] = [];
    const riskCodeToSeverity: Record<string, SeverityLevel> = {
      '3': 'critical',
      '2': 'high',
      '1': 'medium',
      '0': 'low',
    };

    for (const site of report.site || []) {
      for (const alert of site.alerts || []) {
        const severity = riskCodeToSeverity[alert.riskcode] || 'info';

        let description = alert.desc || '';
        if (alert.solution) {
          description += `\n\nSolution: ${alert.solution}`;
        }
        if (alert.otherinfo) {
          description += `\n\nOther Info: ${alert.otherinfo}`;
        }
        if (alert.reference) {
          description += `\n\nReference: ${alert.reference}`;
        }

        findings.push({
          scan_id: '',
          scanner: 'zap',
          scan_type: 'dast',
          severity,
          title: alert.name || alert.alert,
          description: description.trim(),
          file_path: alert.instances?.[0]?.uri,
          cwe_id: alert.cweid,
          rule_id: alert.pluginid,
          raw_sarif: {
            confidence: alert.confidence,
            wascid: alert.wascid,
            alertRef: alert.alertRef,
            instance_count: parseInt(alert.count, 10) || 0,
            instances: alert.instances,
          },
        });
      }
    }

    console.log(`[DAST] ZAP found ${findings.length} issues`);
    return findings;
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('[DAST] ZAP scan timed out after 10 minutes');
      return [];
    }

    console.error('[DAST] ZAP scan failed:', error);
    return [];
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
  }
}

function getDockerReachableUrl(targetUrl: string): string {
  const url = new URL(targetUrl);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.hostname = 'host.docker.internal';
  }

  return url.toString();
}
