import type { ScanFinding } from '../../../shared/types';
type FindingWithoutMeta = Omit<ScanFinding, 'id' | 'created_at'>;
export declare function runTrivy(repoDir: string, scanId: string): Promise<FindingWithoutMeta[]>;
export {};
