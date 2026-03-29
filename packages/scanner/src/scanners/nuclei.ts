import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

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

const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
const NUCLEI_TIMEOUT_MS = 5 * 60 * 1000;

interface NucleiOutput {
  template: string;
  template_id: string;
  template_path: string;
  info: {
    name: string;
    author: string | string[];
    severity: string;
    description?: string;
    reference?: string | string[];
    classification?: {
      cwe_id?: string | string[];
      cvss_score?: number;
    };
  };
  type: string;
  host: string;
  matched_at: string;
  timestamp: string;
  curl_command?: string;
  matcher_status: boolean;
  extracted_results?: string[];
}

export async function runNuclei(
  targetUrl: string,
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuclei-'));
  const outputPath = path.join(tempDir, 'nuclei.jsonl');

  try {
    const start = Date.now();
    const output = await runLocalNuclei(targetUrl, outputPath) ?? await runDockerNuclei(targetUrl, tempDir, outputPath);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!output || !output.trim()) {
      console.log(`[DAST] Nuclei produced no output (${elapsed}s)`);
      return [];
    }

    const findings = parseNucleiOutput(output);
    console.log(`[DAST] Nuclei found ${findings.length} findings in ${elapsed}s`);
    return findings;
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('[DAST] Nuclei scan timed out after 5 minutes');
      return [];
    }

    console.error('[DAST] Nuclei scan failed:', error);
    return [];
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runLocalNuclei(targetUrl: string, outputPath: string): Promise<string | null> {
  try {
    await execFileAsync('nuclei', ['-version'], { timeout: 5000, shell: USE_SHELL });
  } catch {
    console.log('[DAST] Local Nuclei not available, falling back to Docker');
    return null;
  }

  try {
    console.log(`[DAST] Running local Nuclei against ${targetUrl}...`);
    await execFileAsync('nuclei', [
      '-u', targetUrl,
      '-jsonl',
      '-silent',
      '-severity', 'critical,high,medium,low',
      '-as',
      '-o', outputPath,
    ], {
      timeout: NUCLEI_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
      shell: USE_SHELL,
    });
  } catch {
    console.log('[DAST] Nuclei scan completed (may have findings or warnings)');
  }

  return fs.readFile(outputPath, 'utf-8').catch(() => '');
}

async function runDockerNuclei(targetUrl: string, tempDir: string, outputPath: string): Promise<string | null> {
  try {
    await execFileAsync('docker', ['--version']);
  } catch {
    console.warn('[DAST] Docker is not available, skipping Nuclei scan.');
    return null;
  }

  const dockerTargetUrl = getDockerReachableUrl(targetUrl);
  console.log(`[DAST] Running Dockerized Nuclei against ${dockerTargetUrl}...`);

  try {
    await execFileAsync('docker', [
      'run',
      '--rm',
      '--add-host=host.docker.internal:host-gateway',
      '-v',
      `${tempDir}:/work:rw`,
      'projectdiscovery/nuclei:latest',
      '-u',
      dockerTargetUrl,
      '-jsonl',
      '-silent',
      '-severity',
      'critical,high,medium,low',
      '-o',
      '/work/nuclei.jsonl',
    ], {
      timeout: NUCLEI_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    console.log('[DAST] Nuclei scan completed (may have findings or warnings)');
  }

  return fs.readFile(outputPath, 'utf-8').catch(() => '');
}

function parseNucleiOutput(output: string): Omit<ScanFinding, 'id' | 'created_at'>[] {
  const findings: Omit<ScanFinding, 'id' | 'created_at'>[] = [];
  const lines = output.trim().split('\n').filter((line) => line.trim());

  for (const line of lines) {
    try {
      const result: NucleiOutput = JSON.parse(line);
      const severityMap: Record<string, ScanFinding['severity']> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        low: 'low',
        info: 'info',
      };

      let cweId: string | undefined;
      if (result.info.classification?.cwe_id) {
        const cwe = result.info.classification.cwe_id;
        cweId = Array.isArray(cwe) ? cwe[0] : cwe;
      }

      let description = result.info.description || '';
      if (result.extracted_results?.length) {
        description += `\n\nExtracted: ${result.extracted_results.join(', ')}`;
      }
      if (result.curl_command) {
        description += `\n\nCurl: ${result.curl_command}`;
      }

      findings.push({
        scan_id: '',
        scanner: 'nuclei',
        scan_type: 'dast',
        severity: severityMap[result.info.severity.toLowerCase()] || 'info',
        title: result.info.name,
        description: description.trim(),
        file_path: result.matched_at,
        cwe_id: cweId,
        rule_id: result.template_id,
      });
    } catch (parseError) {
      console.warn('[DAST] Failed to parse a Nuclei output line:', parseError);
    }
  }

  return findings;
}

function getDockerReachableUrl(targetUrl: string): string {
  const url = new URL(targetUrl);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.hostname = 'host.docker.internal';
  }

  return url.toString();
}
