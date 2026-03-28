import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AsecClient } from './api-client.js';

export type { CallToolResult };

const SEVERITY_EXPLANATIONS: Record<string, string> = {
  critical: 'Critical — Immediate risk of full system compromise or data breach. Fix before deploying.',
  high: 'High — Significant vulnerability that could be exploited to access sensitive data or take control of part of the system. Fix soon.',
  medium: 'Medium — Exploitable issue but requires additional conditions or attacker access. Address in your next sprint.',
  low: 'Low — Minor security weakness with limited real-world impact. Address when convenient.',
  info: 'Informational — Not a vulnerability, but a security best-practice suggestion worth considering.',
};

export const tools: Tool[] = [
  {
    name: 'scan_repository',
    description: 'Start a security scan on a GitHub repository. Runs SAST, SCA, and DAST analysis to find vulnerabilities in code and dependencies.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_url: {
          type: 'string',
          description: 'Full GitHub URL of the repository to scan (e.g. https://github.com/org/repo)',
        },
        branch: {
          type: 'string',
          description: 'Branch to scan (default: main)',
        },
      },
      required: ['repo_url'],
    },
  },
  {
    name: 'get_scan_status',
    description: 'Check the current status of a security scan. Returns whether it\'s running, complete, or failed.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID returned by scan_repository' },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'list_findings',
    description: 'List security findings from a completed scan with plain-language explanations. Optionally filter by severity or scan type.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID' },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Filter by severity level',
        },
        scan_type: {
          type: 'string',
          enum: ['sast', 'sca', 'dast'],
          description: 'Filter by scan type: sast (code analysis), sca (dependencies), dast (runtime)',
        },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'get_finding_detail',
    description: 'Get full details about a specific security finding, including description, affected file, and remediation guidance.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID' },
        finding_id: { type: 'string', description: 'The finding ID' },
      },
      required: ['scan_id', 'finding_id'],
    },
  },
  {
    name: 'get_fix',
    description: 'Get the AI-generated code fix for a specific security finding. Returns the patched code and an explanation of the change.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID' },
        finding_id: { type: 'string', description: 'The finding ID to get a fix for' },
      },
      required: ['scan_id', 'finding_id'],
    },
  },
  {
    name: 'explain_severity',
    description: 'Explain what a severity level means in plain English — useful for understanding how urgent a finding is.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'The severity level to explain',
        },
      },
      required: ['severity'],
    },
  },
];

function text(content: string): CallToolResult {
  return { content: [{ type: 'text', text: content }] };
}

function error(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: AsecClient
): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'scan_repository': {
        const repoUrl = args.repo_url as string;
        const branch = (args.branch as string | undefined) ?? 'main';
        const result = await client.startScan(repoUrl, branch);
        return text(
          `Scan started successfully!\n\nScan ID: ${result.scan_id}\n\nUse get_scan_status with this ID to check progress, or list_findings once it's complete.`
        );
      }

      case 'get_scan_status': {
        const scanId = args.scan_id as string;
        const status = await client.getScanStatus(scanId);
        const statusMessages: Record<string, string> = {
          queued: 'Queued — waiting to start',
          cloning: 'Cloning the repository...',
          detecting: 'Detecting the tech stack...',
          booting: 'Starting the app for dynamic testing...',
          scanning_sast: 'Running static code analysis (SAST)...',
          scanning_dast: 'Running dynamic security testing (DAST)...',
          scanning_sca: 'Checking dependencies for known vulnerabilities (SCA)...',
          analyzing: 'AI is analyzing and triaging findings...',
          fixing: 'AI is generating code fixes...',
          complete: 'Scan complete ✓',
          failed: `Scan failed: ${status.error_message || 'Unknown error'}`,
        };
        const statusMsg = statusMessages[status.status] ?? status.status;
        return text(
          `Repo: ${status.repo_name || status.repo_url}\nStatus: ${statusMsg}\n` +
          (status.started_at ? `Started: ${new Date(status.started_at).toLocaleString()}\n` : '') +
          (status.completed_at ? `Completed: ${new Date(status.completed_at).toLocaleString()}\n` : '') +
          (status.framework ? `Tech stack: ${status.framework}\n` : '')
        );
      }

      case 'list_findings': {
        const scanId = args.scan_id as string;
        const severity = args.severity as string | undefined;
        const scanType = args.scan_type as string | undefined;
        const { findings, total } = await client.getFindings(scanId, { severity, scan_type: scanType });

        if (findings.length === 0) {
          return text('No findings match the current filters. Great news — this scan looks clean!');
        }

        const lines = [
          `Found ${total} finding${total !== 1 ? 's' : ''}${severity ? ` (severity: ${severity})` : ''}${scanType ? ` (type: ${scanType})` : ''}:\n`,
        ];
        for (const f of findings) {
          lines.push(
            `• [${f.severity.toUpperCase()}] ${f.title}` +
            (f.file_path ? ` — ${f.file_path}${f.line_start ? `:${f.line_start}` : ''}` : '') +
            `\n  Scanner: ${f.scanner} (${f.scan_type.toUpperCase()}) | ID: ${f.id}\n`
          );
        }
        lines.push('\nUse get_finding_detail for more information on any finding.');
        return text(lines.join('\n'));
      }

      case 'get_finding_detail': {
        const scanId = args.scan_id as string;
        const findingId = args.finding_id as string;
        const f = await client.getFindingDetail(scanId, findingId);
        const parts = [
          `${f.title}`,
          `Severity: ${f.severity.toUpperCase()} — ${SEVERITY_EXPLANATIONS[f.severity] ?? f.severity}`,
          `Scanner: ${f.scanner} | Type: ${f.scan_type.toUpperCase()}`,
        ];
        if (f.file_path) {
          parts.push(`Location: ${f.file_path}${f.line_start ? `:${f.line_start}` : ''}`);
        }
        if (f.description) parts.push(`\n${f.description}`);
        if (f.cwe_id) parts.push(`CWE: ${f.cwe_id}`);
        if (f.rule_id) parts.push(`Rule: ${f.rule_id}`);
        parts.push('\nUse get_fix to see the AI-generated code fix for this finding.');
        return text(parts.join('\n'));
      }

      case 'get_fix': {
        const scanId = args.scan_id as string;
        const findingId = args.finding_id as string;
        const fix = await client.getFix(scanId, findingId);

        if (!fix) {
          return text('No AI-generated fix is available for this finding yet. Fixes are only generated for critical and high severity findings with identifiable file paths.');
        }

        const parts = [
          `AI Fix (confidence: ${fix.confidence.toUpperCase()})`,
          `\n${fix.explanation}`,
        ];
        if (fix.diff_patch) {
          parts.push(`\nPatch:\n\`\`\`diff\n${fix.diff_patch}\n\`\`\``);
        } else if (fix.fixed_code) {
          parts.push(`\nFixed code:\n\`\`\`\n${fix.fixed_code}\n\`\`\``);
        }
        return text(parts.join('\n'));
      }

      case 'explain_severity': {
        const severity = (args.severity as string).toLowerCase();
        const explanation = SEVERITY_EXPLANATIONS[severity];
        if (!explanation) {
          return error(`Unknown severity level: ${severity}. Valid values: critical, high, medium, low, info`);
        }
        return text(explanation);
      }

      default:
        return error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(message);
  }
}
