export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScannerType = 'semgrep' | 'zap' | 'nuclei' | 'trivy' | 'npm_audit';
export type ScanCategory = 'sast' | 'dast' | 'sca';
export interface ScanFinding {
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
