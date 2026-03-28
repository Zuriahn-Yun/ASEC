import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Type definitions (mirrored from shared/types)
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

// ZAP JSON report structure
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

/**
 * Run OWASP ZAP baseline scan via Docker
 */
export async function runZap(
  targetUrl: string
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zap-'));
  const reportPath = path.join(tempDir, 'zap-report.json');

  try {
    // Check if Docker is available
    try {
      await execAsync('which docker');
    } catch {
      console.warn('Docker not found in PATH, returning empty array');
      return [];
    }

    // Run ZAP baseline scan via Docker
    const dockerCommand = `docker run --rm --network host \
      -v "${tempDir}:/zap/wrk/:rw" \
      ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py -t "${targetUrl}" -J /zap/wrk/zap-report.json`;

    console.log('Starting ZAP scan...');
    
    try {
      await execAsync(dockerCommand, {
        timeout: 10 * 60 * 1000, // 10 minute timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });
    } catch (execError) {
      // ZAP returns non-zero exit code if it finds issues, which is expected
      // We still want to parse the report if it was generated
      console.log('ZAP scan completed (may have found issues)');
    }

    // Check if report was generated
    try {
      await fs.access(reportPath);
    } catch {
      console.warn('ZAP report not generated, returning empty array');
      return [];
    }

    // Read and parse ZAP JSON report
    const reportContent = await fs.readFile(reportPath, 'utf-8');
    const report: ZapReport = JSON.parse(reportContent);

    // Map ZAP findings to ScanFinding format
    const findings: Omit<ScanFinding, 'id' | 'created_at'>[] = [];

    // Risk code mapping: 3->critical, 2->high, 1->medium, 0->low
    const riskCodeToSeverity: Record<string, SeverityLevel> = {
      '3': 'critical',
      '2': 'high',
      '1': 'medium',
      '0': 'low',
    };

    for (const site of report.site || []) {
      for (const alert of site.alerts || []) {
        const severity = riskCodeToSeverity[alert.riskcode] || 'info';
        
        // Build description
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

        // Get file path from first instance if available
        let filePath: string | undefined;
        if (alert.instances && alert.instances.length > 0) {
          filePath = alert.instances[0].uri;
        }

        const finding: Omit<ScanFinding, 'id' | 'created_at'> = {
          scan_id: '', // Will be set by caller
          scanner: 'zap',
          scan_type: 'dast',
          severity,
          title: alert.name || alert.alert,
          description: description.trim(),
          file_path: filePath,
          cwe_id: alert.cweid,
          rule_id: alert.pluginid,
          raw_sarif: {
            confidence: alert.confidence,
            wascid: alert.wascid,
            alertRef: alert.alertRef,
            instance_count: parseInt(alert.count) || 0,
            instances: alert.instances,
          },
        };

        findings.push(finding);
      }
    }

    console.log(`ZAP scan found ${findings.length} issues`);
    return findings;

  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('ZAP scan timed out after 10 minutes');
      return [];
    }

    console.error('ZAP scan failed:', error);
    return [];
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
