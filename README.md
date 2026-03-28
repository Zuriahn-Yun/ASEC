# SecForge - Autonomous Security Scanner

An autonomous security scanning platform: paste a GitHub repo URL, the system clones it, runs SAST (Semgrep), DAST (OWASP ZAP + Nuclei), and SCA (Trivy + npm audit) scans, boots the target app locally in Docker for DAST, uses AI to triage findings and generate fixes, and streams results to a real-time dashboard. Built on InsForge BaaS.

## Architecture

```
src/                 -- Next.js frontend (pages, components, styles)
packages/scanner/    -- Node.js scan orchestrator (SAST/DAST/SCA pipeline)
packages/backend/    -- InsForge serverless functions + SQL schema
packages/shared/     -- Shared TypeScript types (the integration contract)
```

## InsForge Backend

- URL: `https://66wjtrxb.us-west.insforge.app`
- Project ID: `8e2b49ec-353d-4365-bc07-f061696a90cf`
- SDK: `@insforge/sdk@latest`

## Features

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS 3.4
- **Authentication**: Email/password + OAuth (GitHub, Google)
- **Database**: PostgreSQL with PostgREST API
- **Storage**: File upload/download for scan reports
- **AI**: Chat completions for vulnerability analysis and patch generation
- **Realtime**: WebSocket pub/sub for live scan updates
- **Scanner Pipeline**:
  - SAST: Semgrep static analysis
  - DAST: OWASP ZAP + Nuclei dynamic testing
  - SCA: Trivy + npm audit dependency scanning
  - AI Analyzer: Automatic triage and fix generation

## Getting Started

### Install Dependencies

```bash
npm install
```

### Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_INSFORGE_BASE_URL=https://66wjtrxb.us-west.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_anon_key_here
```

### Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with InsForge provider
│   ├── page.tsx            # Home (redirects to /dashboard)
│   ├── dashboard/page.tsx  # Main dashboard with scan list
│   ├── scan/new/page.tsx   # New scan form
│   ├── scan/[id]/page.tsx  # Scan detail with findings
│   ├── sign-in/page.tsx    # Authentication
│   └── sign-up/page.tsx    # Registration
├── components/
│   ├── InsForgeProvider.tsx   # Auth context
│   ├── FindingsTable.tsx      # Findings data table
│   ├── SeverityChart.tsx      # Severity breakdown chart
│   ├── SeverityBadge.tsx      # Severity indicator
│   ├── DiffViewer.tsx         # Code diff for AI fixes
│   └── FindingDetail.tsx      # Finding detail modal
├── lib/
│   ├── insforge.ts            # SDK client
│   └── useScanRealtime.ts     # Realtime subscription hook
└── hooks/
    └── useRealtimeScan.ts     # Alternative realtime hook

packages/
├── scanner/
│   └── src/
│       ├── index.ts           # Pipeline exports
│       ├── orchestrator.ts    # Main scan orchestrator
│       ├── server.ts          # HTTP server for scan endpoint
│       ├── clone.ts           # Git repo cloning
│       ├── detect.ts          # Tech stack detection
│       ├── boot.ts            # Docker boot for DAST
│       ├── cleanup.ts         # Cleanup after scans
│       ├── ai-analyzer.ts     # AI analysis
│       ├── reporter.ts        # Report generation
│       └── scanners/
│           ├── semgrep.ts     # SAST scanner
│           ├── zap.ts         # DAST scanner (OWASP ZAP)
│           ├── trivy.ts       # SCA scanner
│           ├── npm-audit.ts   # NPM audit scanner
│           └── nuclei.ts      # Nuclei scanner
├── backend/
│   └── functions/
│       └── start-scan/
│           └── index.ts       # Edge function to queue scans
└── shared/
    ├── types/
    │   ├── scan.ts            # ScanJob, ScanStatus
    │   ├── finding.ts         # ScanFinding, SeverityLevel
    │   ├── fix.ts             # Fix, ScanSummary
    │   ├── realtime.ts        # RealtimeEvent payloads
    │   └── index.ts           # Type exports
    └── constants.ts           # Severity colors, scan steps
```

## Team

- **Jack**: Claude Code + Codex
- **Zuriahn**: Claude Code
- **Anderson**: Codex

## Known Issues

### Critical

- **Backend Not Functional**: The backend infrastructure is not fully operational. The `start-scan` edge function exists but does not properly trigger the scanner pipeline. The scanner HTTP server is implemented but not receiving requests.

- **Database Schema Mismatch**: Frontend queries `scan_jobs` table but the actual table may be named `scans`. Need to align frontend data model with backend schema (Issue #35).

### Authentication

- **Missing OTP Code Input**: After requesting a one-time code via email (Gmail), there is no input field on the page to enter the verification code. The UI only shows email/password fields without the OTP verification step.

### UI/UX

- **Dashboard Loading State**: Dashboard shows infinite spinner when auth state is loading. May need better error handling for unauthenticated users.

### Backend Integration

- **Scanner Pipeline Not Triggered**: The `start-scan` edge function creates a scan record in the database but does not actually invoke the scanner HTTP server at `POST /scan`.

- **Missing DB Setup Script**: No automated script to execute the SQL schema and create required tables (`scan_jobs`, `findings`, `patches`, `scan_summaries`).

## Coordination

This project uses GitHub Issues as the task queue and PRs as the delivery mechanism.

- **Branch naming**: `<person>/<issue-number>-<short-desc>` (e.g., `zuriahn/3-scan-form`)
- **Commit message**: `feat: <description> (closes #<number>)`
- **Never push directly to `main`** - All work goes through PRs

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [InsForge Documentation](https://insforge.dev/docs)
