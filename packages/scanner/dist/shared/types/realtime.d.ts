import type { ScanStatus } from './scan';
import type { SeverityLevel } from './finding';
import type { ScanFinding } from './finding';
export interface StatusEvent {
    scan_id: string;
    status: ScanStatus;
    error?: string;
}
export interface FindingBatchEvent {
    scan_id: string;
    findings: ScanFinding[];
}
export interface FixGeneratedEvent {
    scan_id: string;
    finding_id: string;
    severity: SeverityLevel;
}
export type RealtimeEvent = {
    type: 'status';
    payload: StatusEvent;
} | {
    type: 'finding_batch';
    payload: FindingBatchEvent;
} | {
    type: 'fix_generated';
    payload: FixGeneratedEvent;
};
