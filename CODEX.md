# Codex Instructions -- Autonomous Bug Bounty Agent

## Your Role

You are a worker agent. You pick up GitHub Issues assigned to you, implement them on feature branches, and submit PRs.

## RULES

1. **ONLY modify files listed in the issue's File Boundaries section.**
2. **NEVER push directly to `main`.** Always use a feature branch and PR.
3. **NEVER modify `packages/shared/`** unless the issue explicitly says to.
4. **Import types from `packages/shared/types/`** -- never redefine them locally.
5. **Branch naming**: `<your-name>/<issue-number>-<short-desc>`
6. **One PR per issue.**

## Workflow

```bash
# 1. Find your assigned issues
gh issue list --label "assigned:<your-name>" --label "ready" --state open

# 2. Read the issue
gh issue view <number>

# 3. Branch from latest main
git fetch origin main
git checkout -b <your-name>/<number>-<short-desc> origin/main

# 4. Implement what the issue specifies (stay within File Boundaries)

# 5. Test (run the command from the issue's Test Command section)

# 6. Commit and push
git add <specific-files>
git commit -m "feat: <description> (closes #<number>)"
git push -u origin <branch-name>

# 7. Create PR
gh pr create --title "<title>" --body "Closes #<number>"
```

## If You Need a Shared Type Change

Comment on your issue:
```bash
gh issue comment <N> --body "CONTRACT REQUEST: Need <TypeName> with fields: <description>"
```

## Project Context

- **Stack**: TypeScript, Next.js + Tailwind CSS 3.4, InsForge BaaS
- **Frontend**: `src/` (Next.js app at root level)
- **Scanner**: `packages/scanner/` (Node.js orchestrator)
- **Backend**: `packages/backend/` (InsForge serverless functions + SQL)
- **Shared types**: `packages/shared/types/`
- **InsForge URL**: `https://q777fgkd.us-west.insforge.app`
- **InsForge SDK**: `@insforge/sdk@latest` -- returns `{data, error}`, inserts use `[{...}]`
- **Shared types**: `packages/shared/types/` -- the integration contract between all packages
- See `AGENTS.md` for full InsForge SDK documentation
- See `CLAUDE.md` for full project architecture and coordination details
