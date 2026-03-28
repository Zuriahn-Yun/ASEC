import { exec } from 'child_process';
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

const execAsync = promisify(exec);

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
  targetUrl: string
): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]> {
  try {
    // Check if nuclei is installed
    try {
      await execAsync('which nuclei');
    } catch {
      console.warn('Nuclei not found in PATH, returning empty array');
      return [];
    }

    // Run nuclei with JSONL output
    const command = `nuclei -u "${targetUrl}" -jsonl -silent -severity critical,high,medium,low`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 5 * 60 * 1000, // 5 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    });

    if (stderr && !stdout) {
      console.error('Nuclei stderr:', stderr);
      return [];
    }

    // Parse JSONL output (one JSON object per line)
    const findings: Omit<ScanFinding, 'id' | 'created_at'>[] = [];
    const lines = stdout.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const result: NucleiOutput = JSON.parse(line);
        
        // Map severity to our format
        const severityMap: Record<string, ScanFinding['severity']> = {
          'critical': 'critical',
          'high': 'high',
          'medium': 'medium',
          'low': 'low',
          'info': 'info',
        };

        // Extract CWE ID if available
        let cweId: string | undefined;
        if (result.info.classification?.cwe_id) {
          const cwe = result.info.classification.cwe_id;
          cweId = Array.isArray(cwe) ? cwe[0] : cwe;
        }

        // Build description
        let description = result.info.description || '';
        if (result.extracted_results && result.extracted_results.length > 0) {
          description += `\n\nExtracted: ${result.extracted_results.join(', ')}`;
        }
        if (result.curl_command) {
          description += `\n\nCurl: ${result.curl_command}`;
        }

        const finding: Omit<ScanFinding, 'id' | 'created_at'> = {
          scan_id: '', // Will be set by caller
          scanner: 'nuclei',
          scan_type: 'dast',
          severity: severityMap[result.info.severity.toLowerCase()] || 'info',
          title: result.info.name,
          description: description.trim(),
          file_path: result.matched_at,
          cwe_id: cweId,
          rule_id: result.template_id,
        };

        findings.push(finding);
      } catch (parseError) {
        console.warn('Failed to parse nuclei output line:', line, parseError);
        continue;
      }
    }

    return findings;
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('Nuclei scan timed out after 5 minutes');
      return [];
    }
    
    console.error('Nuclei scan failed:', error);
    return [];
  }
}
