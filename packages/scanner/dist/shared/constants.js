export const SEVERITY_ORDER = [
    'critical',
    'high',
    'medium',
    'low',
    'info',
];
export const SEVERITY_COLORS = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
};
export const SEVERITY_LABELS = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Info',
};
export const SCAN_STEPS = [
    'queued',
    'cloning',
    'detecting',
    'booting',
    'scanning_sast',
    'scanning_dast',
    'scanning_sca',
    'analyzing',
    'fixing',
    'complete',
];
export const SCAN_STEP_LABELS = {
    queued: 'Queued',
    cloning: 'Cloning Repo',
    detecting: 'Detecting Framework',
    booting: 'Booting App',
    scanning_sast: 'SAST Scan',
    scanning_dast: 'DAST Scan',
    scanning_sca: 'SCA Scan',
    analyzing: 'AI Analysis',
    fixing: 'Generating Fixes',
    complete: 'Complete',
    failed: 'Failed',
};
export const SCANNER_TYPES = ['semgrep', 'zap', 'nuclei', 'trivy', 'npm_audit'];
export const SCAN_CATEGORIES = ['sast', 'dast', 'sca'];
