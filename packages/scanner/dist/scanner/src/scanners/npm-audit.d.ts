import type { ScanFinding } from '../../../shared/types';
type FindingWithoutMeta = Omit<ScanFinding, 'id' | 'created_at'>;
export declare function runNpmAudit(repoDir: string, scanId: string): Promise<FindingWithoutMeta[]>;
export {};
