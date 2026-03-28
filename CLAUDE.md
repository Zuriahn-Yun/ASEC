# Autonomous Bug Bounty Agent -- Multi-Agent Coordination

## Project Overview

An autonomous security scanning agent: paste a GitHub repo URL, the system clones it, runs SAST (Semgrep), DAST (OWASP ZAP + Nuclei), and SCA (Trivy + npm audit) scans, boots the target app locally in Docker for DAST, uses AI to triage findings and generate fixes, and streams results to a real-time dashboard. Built on InsForge BaaS.

## Architecture

```
src/                 -- Next.js frontend (pages, components, styles)
packages/scanner/    -- Node.js scan orchestrator (SAST/DAST/SCA pipeline)
packages/backend/    -- InsForge serverless functions + SQL schema
packages/shared/     -- Shared TypeScript types (the integration contract)
```

## InsForge Backend

- URL: `https://q777fgkd.us-west.insforge.app`
- Project ID: `8e2b49ec-353d-4365-bc07-f061696a90cf`
- SDK: `@insforge/sdk@latest`
- Use `fetch-docs` MCP tool before writing InsForge integration code
- Use Tailwind CSS 3.4 (NOT v4)
- SDK returns `{data, error}` -- always handle both
- Database inserts require array format: `[{...}]`

## Team

- **Jack**: Claude Code + Codex
- **Zuriahn**: Claude Code
- **Anderson**: Codex

## Coordination Model

GitHub Issues are the task queue. PRs are the delivery mechanism.

- A **coordinator agent** sits on `main`, creates issues, assigns them, reviews PRs, merges, and audits integration.
- **Worker agents** on each machine pick up assigned issues, implement on branches, and submit PRs.
- No fixed roles -- anyone can get any task. The coordinator assigns dynamically.

---

## CRITICAL RULES (ALL AGENTS)

1. **NEVER push directly to `main`.** All work goes through PRs.
2. **ONLY modify files listed in the issue's File Boundaries section.** If you need to touch something outside, comment on the issue and ask the coordinator.
3. **NEVER modify `packages/shared/`** unless you are the coordinator or the issue explicitly assigns you a shared type change.
4. **Always import types from `packages/shared/types/`** -- never redefine them locally.
5. **One PR per issue. One issue per PR.** Reference the issue number in PR body.
6. **Branch naming**: `<person>/<issue-number>-<short-desc>` (e.g., `zuriahn/3-scan-form`)
7. **Commit message**: `feat: <description> (closes #<number>)`
8. **Before creating a PR**, always rebase on latest main:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
9. **Check `git diff --stat` before committing** to verify you only touched allowed files.

---

## FOR COORDINATOR AGENT

You manage the project from the `main` branch. Your loop:

### 1. Review PRs
```bash
gh pr list --state open
```
For each open PR:
- Read the linked issue: `gh issue view <N>`
- Check the diff: `gh pr diff <N>`
- Verify: files within boundaries? Interface contract met? No secrets?
- If good: `gh pr merge <N> --squash`
- If bad: `gh pr review <N> --request-changes --body "specific feedback"`

### 2. Check Project Status
```bash
gh issue list --state open
```
- Are blocked issues now unblocked? Remove `blocked` label, add `ready`.
- Does someone need more work? Assign next issues from the backlog.

### 3. Audit Integration
After merging PRs, pull main and verify:
```bash
git pull origin main
npm install
# Run builds in affected packages
```
If integration issues found, create follow-up issues with specific fix instructions.

### 4. Create Issues
Use the agent-task template. Every issue MUST include:
- **File Boundaries**: exact paths to create/modify
- **Interface Contract**: TypeScript signatures
- **Acceptance Criteria**: testable checks
- **Test Command**: how to verify

Label issues: `assigned:<person>`, component label, priority label, `ready`.

---

## FOR WORKER AGENT

You implement issues on feature branches.

### Workflow
1. Find your work:
   ```bash
   gh issue list --label "assigned:<your-name>" --label "ready" --state open
   ```
2. Pick the highest priority issue. Read it fully:
   ```bash
   gh issue view <number>
   ```
3. Create a branch:
   ```bash
   git fetch origin main
   git checkout -b <your-name>/<number>-<short-desc> origin/main
   ```
4. Implement EXACTLY what the issue specifies. Stay within File Boundaries.
5. Run the test command from the issue.
6. Commit and push:
   ```bash
   git add <specific-files>
   git commit -m "feat: <description> (closes #<number>)"
   git push -u origin <branch-name>
   ```
7. Create PR:
   ```bash
   gh pr create --title "<title>" --body "Closes #<number>"
   ```
8. Check for next issue or address review feedback.

### If You Need a Shared Type Change
Do NOT edit `packages/shared/` yourself. Comment on your issue:
```bash
gh issue comment <N> --body "CONTRACT REQUEST: Need <TypeName> with fields: <description>"
```
The coordinator will handle it.

---

## IMPORTANT: All Workers Use Branches (Including Jack's)

Jack runs TWO separate sessions:
1. **Coordinator session** -- stays on `main`, reviews PRs, merges, creates issues
2. **Worker session** -- creates branches like everyone else: `jack/<issue#>-<desc>`

The coordinator is the ONLY thing that runs on `main`. All implementation work, by anyone, happens on feature branches via PRs.

---

## Shared Types Contract

All cross-package interfaces live in `packages/shared/types/`. This is the integration contract:

- `scan.ts`: ScanJob, ScanStatus, ScanRequest
- `finding.ts`: ScanFinding, SeverityLevel, ScannerType, ScanCategory
- `fix.ts`: Fix, ScanSummary
- `realtime.ts`: RealtimeEvent payloads
- `constants.ts`: Severity colors, scan step order

Read these before writing any code that produces or consumes scan data.
