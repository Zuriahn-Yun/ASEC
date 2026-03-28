# **SecForge**

Autonomous AI-powered security scanner for GitHub repositories. Performs SAST, DAST, and SCA analysis with AI-generated vulnerability fixes.

## Features

- 🔍 **SAST** - Static analysis with Semgrep
- 🌐 **DAST** - Dynamic testing with OWASP ZAP and Nuclei
- 📦 **SCA** - Dependency scanning with Trivy and npm audit
- 🤖 **AI Analysis** - Automatic triage and fix generation
- 📊 **Real-time Dashboard** - Live scan progress and findings
- 🔐 **Secure Auth** - Email verification with OTP

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for scanner tools)
- InsForge account

### Install Dependencies

```bash
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-app.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key
```

### Database Setup

Run the database setup script to create tables:

```bash
cd packages/backend
npm install
npm run setup-db
```

### Start Development Servers

**Terminal 1: Frontend**
```bash
npm run dev
```

**Terminal 2: Scanner Pipeline Server**
```bash
cd packages/scanner
npm install
INSFORGE_BASE_URL=https://your-app.insforge.app \
INSFORGE_ANON_KEY=your-anon-key \
npm run dev:server
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Scanner Package

- `npm run dev:server` - Start scanner HTTP server (port 4000)
- `npm run build` - Build scanner package

### Backend Package

- `npm run setup-db` - Create database tables

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── sign-in/           # Authentication pages
│   ├── sign-up/
│   ├── dashboard/         # Main dashboard
│   └── scan/              # Scan details and new scan
├── components/            # React components
│   ├── FindingsTable.tsx
│   ├── SeverityBadge.tsx
│   └── SeverityChart.tsx
└── lib/
    └── insforge.ts        # InsForge SDK client

packages/
├── scanner/               # Security scanner pipeline
│   ├── src/
│   │   ├── server.ts      # HTTP server (port 4000)
│   │   ├── orchestrator.ts # Pipeline orchestration
│   │   ├── scanners/      # Scanner wrappers
│   │   │   ├── semgrep.ts
│   │   │   ├── zap.ts
│   │   │   ├── nuclei.ts
│   │   │   ├── trivy.ts
│   │   │   └── npm-audit.ts
│   │   ├── ai-analyzer.ts
│   │   └── reporter.ts
│   └── package.json
├── backend/               # InsForge serverless functions
│   ├── functions/
│   │   └── start-scan/    # Edge function to start scans
│   └── scripts/
│       └── setup-db.ts    # Database setup script
└── shared/                # Shared types
```

## How It Works

1. **User initiates scan** from the web UI
2. **Start-scan function** creates a scan job record
3. **Scanner HTTP server** receives the job and starts the pipeline
4. **Pipeline stages**:
   - Clone repository
   - Detect framework
   - Run SAST (Semgrep)
   - Boot application
   - Run DAST (ZAP + Nuclei)
   - Run SCA (Trivy + npm audit)
   - AI analysis and fix generation
   - Store findings in database
5. **Real-time updates** via WebSockets show progress
6. **Dashboard displays** findings with severity and AI fixes

## Known Issues

- **Missing OTP Code Input** - Email verification UI needs OTP input (Issue #57, fix in progress)
- **Dashboard Loading State** - Initial dashboard load shows empty state briefly
- **Database Schema Mismatch** - Frontend data model alignment in progress (Issue #35, PR pending)

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: InsForge (PostgreSQL, Auth, Realtime)
- **Scanner**: Node.js, Express, Docker
- **AI**: OpenAI-compatible API via InsForge

## Learn More

- [InsForge Documentation](https://insforge.dev/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com)
