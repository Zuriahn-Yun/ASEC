import type { ScanFinding, Fix } from '../../shared/types';
type FixWithoutMeta = Omit<Fix, 'id' | 'created_at'>;
/**
 * Send findings to AI for triage: dedup, re-assess severity, prioritize.
 * Limits to top 50 findings to control token usage.
 */
export declare function triageFindings(findings: ScanFinding[]): Promise<ScanFinding[]>;
/**
 * For top critical/high findings with file paths, generate code fixes using AI.
 * Limits to 20 findings to control token usage and latency.
 */
export declare function generateFixes(findings: ScanFinding[], repoDir: string, scanId: string): Promise<FixWithoutMeta[]>;
/**
 * Generate plain-language explanations for findings.
 * Explains security issues to developers with no security background.
 * Processes findings in batches of 5-10 to control token usage.
 */
export declare function generateExplanations(findings: ScanFinding[]): Promise<ScanFinding[]>;
export {};
