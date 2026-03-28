export interface Fix {
    id: string;
    finding_id: string;
    scan_id: string;
    explanation: string;
    original_code?: string;
    fixed_code?: string;
    diff_patch?: string;
    confidence: 'high' | 'medium' | 'low';
    created_at: string;
}
export interface ScanSummary {
    scan_id: string;
    total_findings: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    info_count: number;
    sast_count: number;
    dast_count: number;
    sca_count: number;
    fixes_generated: number;
}
