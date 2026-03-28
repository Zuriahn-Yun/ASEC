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
export declare function runZap(targetUrl: string): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]>;
export {};
