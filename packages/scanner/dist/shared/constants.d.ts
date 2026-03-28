import type { SeverityLevel, ScanStatus } from './types';
export declare const SEVERITY_ORDER: SeverityLevel[];
export declare const SEVERITY_COLORS: Record<SeverityLevel, string>;
export declare const SEVERITY_LABELS: Record<SeverityLevel, string>;
export declare const SCAN_STEPS: ScanStatus[];
export declare const SCAN_STEP_LABELS: Record<ScanStatus, string>;
export declare const SCANNER_TYPES: readonly ["semgrep", "zap", "nuclei", "trivy", "npm_audit"];
export declare const SCAN_CATEGORIES: readonly ["sast", "dast", "sca"];
