#!/bin/bash
# Run this after: gh auth login
# Creates all GitHub labels and Wave 1-3 issues for the project

REPO="Zuriahn-Yun/ASEC"

echo "=== Creating Labels ==="

# Assignment labels
gh label create "assigned:jack" --color "0E8A16" --description "Assigned to Jack" --repo "$REPO" --force
gh label create "assigned:zuriahn" --color "1D76DB" --description "Assigned to Zuriahn" --repo "$REPO" --force
gh label create "assigned:anderson" --color "D93F0B" --description "Assigned to Anderson" --repo "$REPO" --force

# Component labels
gh label create "frontend" --color "C5DEF5" --description "Next.js frontend (src/)" --repo "$REPO" --force
gh label create "scanner" --color "F9D0C4" --description "Scanner pipeline (packages/scanner/)" --repo "$REPO" --force
gh label create "backend" --color "D4C5F9" --description "Backend functions (packages/backend/)" --repo "$REPO" --force
gh label create "shared" --color "FEF2C0" --description "Shared types (packages/shared/)" --repo "$REPO" --force
gh label create "infra" --color "E8E8E8" --description "Infrastructure and tooling" --repo "$REPO" --force

# Priority labels
gh label create "P0-critical" --color "B60205" --description "Must do first, blocks everything" --repo "$REPO" --force
gh label create "P1-high" --color "D93F0B" --description "Do next" --repo "$REPO" --force
gh label create "P2-medium" --color "FBCA04" --description "Do when P0/P1 done" --repo "$REPO" --force

# Status labels
gh label create "ready" --color "0E8A16" --description "Fully specified, ready to pick up" --repo "$REPO" --force
gh label create "blocked" --color "E4E669" --description "Waiting on another issue" --repo "$REPO" --force

echo ""
echo "=== Creating Wave 1 Issues (P0 - no dependencies) ==="

# Issue 1: DB Schema
gh issue create --repo "$REPO" \
  --title "[BACKEND] Create database schema via InsForge" \
  --label "backend,P0-critical,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create all database tables in InsForge PostgreSQL for the security scanning pipeline.

## Context
Depends on: none
Blocks: all scanner and frontend data display issues

## File Boundaries
- REFERENCE: `packages/backend/sql/schema.sql` (already committed -- use this as the source)
- Use InsForge `run-raw-sql` MCP tool to execute the SQL
- DO NOT TOUCH: anything in `src/` or `packages/scanner/`

## Interface Contract
Tables must match the types in `packages/shared/types/`:
- `scan_jobs` matches `ScanJob` interface
- `findings` matches `ScanFinding` interface
- `fixes` matches `Fix` interface
- `scan_summaries` matches `ScanSummary` interface

## Acceptance Criteria
- [ ] All 4 tables created in InsForge PostgreSQL
- [ ] All indexes created
- [ ] Can insert and query a test row in each table
- [ ] Column names match the shared TypeScript types exactly

## Test Command
\`\`\`bash
# Verify via InsForge MCP: get-table-schema for each table
\`\`\`

## Implementation Notes
- The SQL is already written at `packages/backend/sql/schema.sql`
- Execute it via the InsForge `run-raw-sql` MCP tool
- Verify each table with `get-table-schema`
ISSUE_EOF
)"

# Issue 2: start-scan serverless function
gh issue create --repo "$REPO" \
  --title "[BACKEND] Implement start-scan serverless function" \
  --label "backend,P0-critical,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create an InsForge serverless function that accepts a repo URL and creates a scan job.

## Context
Depends on: DB schema issue
Blocks: frontend scan trigger, scanner pipeline

## File Boundaries
- CREATE: `packages/backend/functions/start-scan/index.ts`
- DO NOT TOUCH: `src/`, `packages/scanner/`, `packages/shared/`

## Interface Contract
\`\`\`typescript
// Input (POST body)
import { ScanRequest } from '../../shared/types';
// { repo_url: string, branch?: string }

// Output
// { scan_id: string }

// Behavior:
// 1. Validate repo_url (must be a valid GitHub URL)
// 2. Extract repo_name from URL
// 3. Get user_id from InsForge auth context
// 4. Insert row into scan_jobs with status 'queued'
// 5. Return { scan_id: <new-job-id> }
\`\`\`

## Acceptance Criteria
- [ ] Function accepts POST with { repo_url, branch? }
- [ ] Validates GitHub URL format
- [ ] Inserts scan_jobs row with status 'queued'
- [ ] Returns { scan_id } on success
- [ ] Returns error on invalid input
- [ ] Deployed via InsForge CLI

## Test Command
\`\`\`bash
# Deploy: use InsForge create-function MCP tool
# Test: curl the function endpoint with a test payload
\`\`\`

## Implementation Notes
- Use InsForge SDK `createClient()` with service role for DB access
- See AGENTS.md for function deployment docs
- Use `fetch-docs` MCP tool with "functions-sdk" for function patterns
ISSUE_EOF
)"

# Issue 3: Scanner pipeline scaffold
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement clone, detect, and pipeline orchestrator" \
  --label "scanner,P0-critical,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Build the core scanner pipeline: clone a repo, detect its framework, and orchestrate scan steps.

## Context
Depends on: none (can work standalone initially)
Blocks: all individual scanner wrapper issues

## File Boundaries
- CREATE: \`packages/scanner/src/orchestrator.ts\`
- CREATE: \`packages/scanner/src/clone.ts\`
- CREATE: \`packages/scanner/src/detect.ts\`
- CREATE: \`packages/scanner/src/boot.ts\`
- CREATE: \`packages/scanner/src/cleanup.ts\`
- MODIFY: \`packages/scanner/src/index.ts\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
// clone.ts
export async function cloneRepo(repoUrl: string, branch?: string): Promise<string>;
// Returns path to cloned temp directory

// detect.ts
export interface DetectionResult {
  framework: string;    // 'express' | 'nextjs' | 'django' | 'flask' | 'spring' | 'unknown'
  runtime: string;      // 'node' | 'python' | 'java' | 'unknown'
  startCommand: string;
  port: number;
}
export async function detectFramework(repoDir: string): Promise<DetectionResult>;

// boot.ts
export async function bootApp(repoDir: string, detection: DetectionResult): Promise<{ containerId: string; appUrl: string }>;
export async function stopApp(containerId: string): Promise<void>;

// cleanup.ts
export async function cleanup(repoDir: string, containerId?: string): Promise<void>;

// orchestrator.ts
import { ScanJob } from '../../shared/types';
export async function runPipeline(job: ScanJob): Promise<void>;
// Sequences: clone -> detect -> SAST -> boot -> DAST -> teardown -> SCA -> AI -> report -> cleanup
\`\`\`

## Acceptance Criteria
- [ ] \`cloneRepo\` clones a public GitHub repo into a temp directory
- [ ] \`detectFramework\` correctly identifies Express, Next.js, Django, Flask from package.json/requirements.txt
- [ ] \`bootApp\` starts a Docker container and waits for health check
- [ ] \`stopApp\` stops and removes the container
- [ ] \`cleanup\` removes temp directory and stops any running container
- [ ] \`orchestrator\` sequences all steps with proper error handling
- [ ] If DAST boot fails, pipeline continues with SAST + SCA only (graceful degradation)
- [ ] TypeScript compiles: \`cd packages/scanner && npx tsc --noEmit\`

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
# Manual test: run against https://github.com/OWASP/NodeGoat
\`\`\`

## Implementation Notes
- Use \`child_process.execFile\` or \`execa\` for git/docker commands
- Docker template Dockerfiles are at \`packages/scanner/templates/docker/\`
- Health check: poll \`http://localhost:<port>/\` with retries (max 60s)
- Framework detection table:
  | File | Framework | Port | Command |
  |------|-----------|------|---------|
  | package.json + next | Next.js | 3000 | npm run build && npm start |
  | package.json + express | Express | 3000 | npm start |
  | requirements.txt + django | Django | 8000 | python manage.py runserver |
  | requirements.txt + flask | Flask | 5000 | flask run --host=0.0.0.0 |
ISSUE_EOF
)"

# Issue 4: Semgrep SAST wrapper
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement Semgrep SAST scanner wrapper" \
  --label "scanner,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create a wrapper that runs Semgrep against a cloned repo and returns normalized findings.

## Context
Depends on: scanner scaffold issue
Blocks: full pipeline integration

## File Boundaries
- CREATE: \`packages/scanner/src/scanners/semgrep.ts\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding } from '../../../shared/types';

export async function runSemgrep(repoDir: string): Promise<ScanFinding[]>;
// 1. Run: semgrep scan --config auto --sarif --quiet <repoDir>
// 2. Parse SARIF JSON output
// 3. Map each result to ScanFinding with scanner='semgrep', scan_type='sast'
// 4. Map SARIF severity to our SeverityLevel
\`\`\`

## Acceptance Criteria
- [ ] Runs semgrep with auto config
- [ ] Parses SARIF output into ScanFinding[]
- [ ] Maps severity correctly (error->high, warning->medium, note->low, none->info)
- [ ] Handles semgrep not found gracefully (returns empty array with warning)
- [ ] Timeout after 5 minutes
- [ ] TypeScript compiles

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
\`\`\`

## Implementation Notes
- Semgrep outputs SARIF with \`--sarif\` flag
- Use \`child_process.execFile\` with timeout option
- SARIF structure: \`runs[0].results[]\` contains the findings
- Each result has \`ruleId\`, \`level\`, \`message.text\`, \`locations[0].physicalLocation\`
ISSUE_EOF
)"

# Issue 5: ZAP DAST wrapper
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement OWASP ZAP DAST scanner wrapper" \
  --label "scanner,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create a wrapper that runs OWASP ZAP against a running application and returns findings.

## Context
Depends on: scanner scaffold (boot.ts for running the app)
Blocks: full pipeline integration

## File Boundaries
- CREATE: \`packages/scanner/src/scanners/zap.ts\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding } from '../../../shared/types';

export async function runZap(targetUrl: string): Promise<ScanFinding[]>;
// 1. Run ZAP via Docker: docker run --rm --network host ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t <url> -J report.json
// 2. Parse ZAP JSON report
// 3. Map to ScanFinding[] with scanner='zap', scan_type='dast'
\`\`\`

## Acceptance Criteria
- [ ] Runs ZAP baseline scan via Docker
- [ ] Parses JSON report into ScanFinding[]
- [ ] Maps ZAP risk levels: 3->critical, 2->high, 1->medium, 0->low
- [ ] Timeout after 10 minutes
- [ ] Returns empty array if ZAP fails (graceful degradation)

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
\`\`\`
ISSUE_EOF
)"

# Issue 6: Trivy + npm audit SCA wrappers
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement Trivy and npm audit SCA wrappers" \
  --label "scanner,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create wrappers for Trivy filesystem scan and npm audit to detect vulnerable dependencies.

## Context
Depends on: scanner scaffold
Blocks: full pipeline integration

## File Boundaries
- CREATE: \`packages/scanner/src/scanners/trivy.ts\`
- CREATE: \`packages/scanner/src/scanners/npm-audit.ts\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding } from '../../../shared/types';

// trivy.ts
export async function runTrivy(repoDir: string): Promise<ScanFinding[]>;
// Run: trivy fs --format sarif --quiet <repoDir>
// Parse SARIF, map to ScanFinding[] with scanner='trivy', scan_type='sca'

// npm-audit.ts
export async function runNpmAudit(repoDir: string): Promise<ScanFinding[]>;
// Run: cd <repoDir> && npm audit --json
// Parse JSON, map to ScanFinding[] with scanner='npm_audit', scan_type='sca'
\`\`\`

## Acceptance Criteria
- [ ] Trivy runs and parses SARIF output
- [ ] npm audit runs and handles exit code 1 (vulns found = expected)
- [ ] Both map severity correctly
- [ ] Both return empty array on tool-not-found (graceful degradation)
- [ ] TypeScript compiles

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
\`\`\`
ISSUE_EOF
)"

# Issue 7: AI Analyzer
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement AI analyzer for triage and fix generation" \
  --label "scanner,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Use InsForge AI SDK to triage findings (re-assess severity, dedup) and generate code fixes.

## Context
Depends on: scanner scaffold, shared types
Blocks: fix display on frontend

## File Boundaries
- CREATE: \`packages/scanner/src/ai-analyzer.ts\`
- CREATE: \`packages/scanner/templates/prompts/triage.md\`
- CREATE: \`packages/scanner/templates/prompts/fix.md\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding, Fix } from '../../shared/types';

export async function triageFindings(findings: ScanFinding[]): Promise<ScanFinding[]>;
// Send top 50 findings to AI, get de-duped list with adjusted severity

export async function generateFixes(findings: ScanFinding[], repoDir: string): Promise<Fix[]>;
// For top 20 critical/high findings with file_path:
// 1. Read source code from repoDir
// 2. Send finding + source to AI
// 3. Get back explanation, original_code, fixed_code, diff_patch, confidence
\`\`\`

## Acceptance Criteria
- [ ] Uses InsForge AI SDK (OpenAI-compatible) for both functions
- [ ] Triage deduplicates and re-ranks findings
- [ ] Fix generation produces before/after code with explanation
- [ ] Limits: max 50 findings for triage, max 20 for fix gen
- [ ] Handles AI errors gracefully (returns original findings if triage fails)

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
\`\`\`

## Implementation Notes
- InsForge AI is OpenAI-compatible: \`client.ai.chat.completions.create()\`
- Use \`fetch-docs\` MCP tool with "ai-integration-sdk" for exact API
- Prompt templates go in \`packages/scanner/templates/prompts/\`
ISSUE_EOF
)"

# Issue 8: Frontend scan trigger + realtime progress
gh issue create --repo "$REPO" \
  --title "[FRONTEND] Wire scan trigger and realtime progress display" \
  --label "frontend,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Connect the existing New Scan page to the start-scan backend function and add real-time scan progress updates.

## Context
Depends on: start-scan function, existing frontend at src/app/scan/new/page.tsx
Blocks: findings display

## File Boundaries
- MODIFY: \`src/app/scan/new/page.tsx\` (wire form submit to start-scan function)
- MODIFY: \`src/app/scan/[id]/page.tsx\` (add realtime progress subscription)
- CREATE: \`src/hooks/useRealtimeScan.ts\` (InsForge Realtime subscription hook)
- DO NOT TOUCH: \`packages/\`

## Interface Contract
\`\`\`typescript
// useRealtimeScan.ts
import { ScanJob, ScanFinding } from '../../packages/shared/types';

export function useRealtimeScan(scanId: string | null): {
  status: ScanJob['status'];
  findings: ScanFinding[];
  error: string | null;
};
// Subscribes to InsForge Realtime channel 'scan:<scanId>'
// Listens for 'status', 'finding_batch', 'fix_generated' events
\`\`\`

## Acceptance Criteria
- [ ] New Scan form calls start-scan InsForge function on submit
- [ ] After submit, redirects to /scan/[id] page
- [ ] Scan detail page shows real-time status stepper
- [ ] Status updates animate through pipeline steps
- [ ] Findings appear as they stream in

## Test Command
\`\`\`bash
npm run build
\`\`\`

## Implementation Notes
- Use InsForge Realtime for WebSocket subscriptions
- Use \`fetch-docs\` MCP tool with "real-time" for subscription patterns
- Existing pages already have basic UI -- wire the data layer
ISSUE_EOF
)"

# Issue 9: Reporter (writes results to DB)
gh issue create --repo "$REPO" \
  --title "[SCANNER] Implement reporter to write results to InsForge DB" \
  --label "scanner,P1-high,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Write scan findings and fixes to InsForge database and broadcast realtime events.

## Context
Depends on: DB schema, shared types
Blocks: frontend data display

## File Boundaries
- CREATE: \`packages/scanner/src/reporter.ts\`
- DO NOT TOUCH: \`src/\`, \`packages/backend/\`, \`packages/shared/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding, Fix, ScanSummary } from '../../shared/types';

export async function updateScanStatus(scanId: string, status: string, error?: string): Promise<void>;
// Update scan_jobs row and broadcast realtime event

export async function insertFindings(scanId: string, findings: ScanFinding[]): Promise<void>;
// Batch insert findings, broadcast finding_batch event

export async function insertFixes(scanId: string, fixes: Fix[]): Promise<void>;
// Batch insert fixes, broadcast fix_generated events

export async function computeSummary(scanId: string): Promise<void>;
// Count findings by severity/type, upsert scan_summaries row
\`\`\`

## Acceptance Criteria
- [ ] All functions use InsForge SDK for DB operations
- [ ] Realtime events broadcast on each status change and finding batch
- [ ] Summary computation is accurate
- [ ] Handles DB errors gracefully

## Test Command
\`\`\`bash
cd packages/scanner && npx tsc --noEmit
\`\`\`
ISSUE_EOF
)"

# Issue 10: Findings display components
gh issue create --repo "$REPO" \
  --title "[FRONTEND] Build findings table and severity chart components" \
  --label "frontend,P2-medium,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create the FindingsTable, SeverityBadge, and SeverityChart components for the scan results page.

## Context
Depends on: shared types, existing scan/[id] page
Blocks: nothing (polish)

## File Boundaries
- CREATE: \`src/components/FindingsTable.tsx\`
- CREATE: \`src/components/SeverityBadge.tsx\`
- CREATE: \`src/components/SeverityChart.tsx\`
- MODIFY: \`src/app/scan/[id]/page.tsx\` (integrate new components)
- DO NOT TOUCH: \`packages/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding, SeverityLevel } from '../../packages/shared/types';

// FindingsTable: displays findings with sort by severity, filter by scanner/type
export function FindingsTable(props: { findings: ScanFinding[], onSelect: (f: ScanFinding) => void }): JSX.Element;

// SeverityBadge: colored pill showing severity
export function SeverityBadge(props: { severity: SeverityLevel }): JSX.Element;

// SeverityChart: donut chart showing count by severity (use recharts)
export function SeverityChart(props: { findings: ScanFinding[] }): JSX.Element;
\`\`\`

## Acceptance Criteria
- [ ] Table is sortable by severity and filterable by scanner type
- [ ] Badges use correct colors from packages/shared/constants.ts
- [ ] Chart renders donut/pie with severity breakdown
- [ ] Clicking a table row triggers onSelect callback
- [ ] Responsive layout with Tailwind 3.4

## Test Command
\`\`\`bash
npm run build
\`\`\`
ISSUE_EOF
)"

# Issue 11: DiffViewer for fixes
gh issue create --repo "$REPO" \
  --title "[FRONTEND] Build DiffViewer and FindingDetail components" \
  --label "frontend,P2-medium,ready" \
  --body "$(cat <<'ISSUE_EOF'
## Objective
Create components to show AI-generated fix details with before/after code diff.

## Context
Depends on: shared types, FindingsTable
Blocks: nothing (polish)

## File Boundaries
- CREATE: \`src/components/DiffViewer.tsx\`
- CREATE: \`src/components/FindingDetail.tsx\`
- DO NOT TOUCH: \`packages/\`

## Interface Contract
\`\`\`typescript
import { ScanFinding, Fix } from '../../packages/shared/types';

// DiffViewer: side-by-side code diff using react-diff-viewer-continued
export function DiffViewer(props: { oldCode: string, newCode: string }): JSX.Element;

// FindingDetail: expanded view of a finding with AI explanation and diff
export function FindingDetail(props: { finding: ScanFinding, fix?: Fix }): JSX.Element;
\`\`\`

## Acceptance Criteria
- [ ] DiffViewer shows side-by-side or unified diff view
- [ ] FindingDetail shows severity, CWE, description, AI explanation
- [ ] If fix exists, shows DiffViewer with before/after code
- [ ] Install react-diff-viewer-continued as dependency

## Test Command
\`\`\`bash
npm run build
\`\`\`
ISSUE_EOF
)"

echo ""
echo "=== Done! Created all labels and issues ==="
echo "Run: gh issue list --repo $REPO --state open"
