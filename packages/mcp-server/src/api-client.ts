import type { ScanJob } from '../../../shared/types/scan.js';
import type { ScanFinding } from '../../../shared/types/finding.js';
import type { Fix, ScanSummary } from '../../../shared/types/fix.js';

export type { ScanJob, ScanFinding, Fix, ScanSummary };

export interface FindingsResponse {
  findings: ScanFinding[];
  total: number;
}

export interface Report {
  scan: ScanJob;
  summary: ScanSummary | null;
  findings: ScanFinding[];
  fixes: Fix[];
  exported_at: string;
}

export class AsecClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        ...(options.headers as Record<string, string> ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ASEC API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async startScan(repoUrl: string, branch = 'main'): Promise<{ scan_id: string }> {
    return this.request('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ repo_url: repoUrl, branch }),
    });
  }

  async getScanStatus(scanId: string): Promise<ScanJob> {
    return this.request(`/api/scan/${scanId}`);
  }

  async getFindings(
    scanId: string,
    filters?: { severity?: string; scan_type?: string }
  ): Promise<FindingsResponse> {
    const params = new URLSearchParams();
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.scan_type) params.set('scan_type', filters.scan_type);
    const qs = params.toString() ? `?${params}` : '';
    return this.request(`/api/scan/${scanId}/findings${qs}`);
  }

  async getFindingDetail(scanId: string, findingId: string): Promise<ScanFinding> {
    // No single-finding endpoint — fetch all findings and filter client-side
    const { findings } = await this.getFindings(scanId);
    const finding = findings.find((f) => f.id === findingId);
    if (!finding) throw new Error(`Finding ${findingId} not found in scan ${scanId}`);
    return finding;
  }

  async getFix(scanId: string, findingId: string): Promise<Fix | null> {
    // No per-finding fix endpoint — fetch full report and match by finding_id
    try {
      const report = await this.getReport(scanId);
      return report.fixes.find((f) => f.finding_id === findingId) ?? null;
    } catch {
      return null;
    }
  }

  async getReport(scanId: string): Promise<Report> {
    return this.request(`/api/scan/${scanId}/report`);
  }
}
