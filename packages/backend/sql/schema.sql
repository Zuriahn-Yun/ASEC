-- Autonomous Bug Bounty Agent -- Database Schema
-- Run via InsForge `run-raw-sql` MCP tool

-- Scan jobs table
CREATE TABLE IF NOT EXISTS scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    repo_url TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    branch TEXT DEFAULT 'main',
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','cloning','detecting','booting','scanning_sast','scanning_dast','scanning_sca','analyzing','fixing','complete','failed')),
    framework TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual findings from all scanners
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    scanner TEXT NOT NULL CHECK (scanner IN ('semgrep','zap','nuclei','trivy','npm_audit')),
    scan_type TEXT NOT NULL CHECK (scan_type IN ('sast','dast','sca')),
    severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    line_start INT,
    line_end INT,
    cwe_id TEXT,
    rule_id TEXT,
    raw_sarif JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AI-generated fixes
CREATE TABLE IF NOT EXISTS fixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scan_jobs(id) ON DELETE CASCADE,
    explanation TEXT NOT NULL,
    original_code TEXT,
    fixed_code TEXT,
    diff_patch TEXT,
    confidence TEXT CHECK (confidence IN ('high','medium','low')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scan summary statistics (denormalized for fast dashboard rendering)
CREATE TABLE IF NOT EXISTS scan_summaries (
    scan_id UUID PRIMARY KEY REFERENCES scan_jobs(id) ON DELETE CASCADE,
    total_findings INT DEFAULT 0,
    critical_count INT DEFAULT 0,
    high_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    low_count INT DEFAULT 0,
    info_count INT DEFAULT 0,
    sast_count INT DEFAULT 0,
    dast_count INT DEFAULT 0,
    sca_count INT DEFAULT 0,
    fixes_generated INT DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_fixes_scan_id ON fixes(scan_id);
CREATE INDEX IF NOT EXISTS idx_fixes_finding_id ON fixes(finding_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
