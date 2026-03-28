import type { ScanFinding } from '../../../shared/types/index.js';
export declare function runSemgrep(repoDir: string): Promise<Omit<ScanFinding, 'id' | 'created_at'>[]>;
