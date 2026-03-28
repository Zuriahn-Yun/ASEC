export interface ScanStatus {
  id: string;
  repo_url: string;
  repo_name: string;
  status: string;
  framework?: string;
  started_at?: string;
  completed_at?: string | null;
  error_message?: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  scanner: string;
  scan_type: string;
  severity: string;
  title: string;
  description?: string;
  file_path?: string;
  line_start?: number;
  cwe_id?: string;
  rule_id?: string;
}

export interface Fix {
  id: string;
  finding_id: string;
  scan_id: string;
  explanation: string;
  original_code?: string;
  fixed_code?: string;
  diff_patch?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface FindingsResponse {
  findings: Finding[];
  total: number;
}

export interface Report {
  scan: ScanStatus;
  summary: {
    total_findings: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    info_count: number;
  } | null;
  findings: Finding[];
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
    return this.request('/api/start-scan', {
      method: 'POST',
      body: JSON.stringify({ repo_url: repoUrl, branch }),
    });
  }

  async getScanStatus(scanId: string): Promise<ScanStatus> {
    return this.request(`/api/scans/${scanId}`);
  }

  async getFindings(
    scanId: string,
    filters?: { severity?: string; scan_type?: string }
  ): Promise<FindingsResponse> {
    const params = new URLSearchParams();
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.scan_type) params.set('scan_type', filters.scan_type);
    const qs = params.toString() ? `?${params}` : '';
    return this.request(`/api/scans/${scanId}/findings${qs}`);
  }

  async getFindingDetail(scanId: string, findingId: string): Promise<Finding> {
    return this.request(`/api/scans/${scanId}/findings/${findingId}`);
  }

  async getFix(scanId: string, findingId: string): Promise<Fix | null> {
    try {
      return await this.request(`/api/scans/${scanId}/findings/${findingId}/fix`);
    } catch {
      return null;
    }
  }

  async getReport(scanId: string): Promise<Report> {
    return this.request(`/api/scans/${scanId}/report`);
  }
}
