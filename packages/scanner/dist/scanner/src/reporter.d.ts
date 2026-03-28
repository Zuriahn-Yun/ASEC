import type { ScanFinding } from '../../shared/types/finding.js';
import type { Fix } from '../../shared/types/fix.js';
export declare function updateScanStatus(scanId: string, status: string, error?: string): Promise<void>;
export declare function updateScanMetadata(scanId: string, metadata: {
    framework?: string;
}): Promise<void>;
export declare function insertFindings(scanId: string, findings: Omit<ScanFinding, 'id' | 'created_at'>[]): Promise<void>;
export declare function updateFindingDescriptions(scanId: string, findings: ScanFinding[]): Promise<void>;
export declare function insertFixes(scanId: string, fixes: Omit<Fix, 'id' | 'created_at'>[]): Promise<void>;
export declare function computeSummary(scanId: string): Promise<void>;
