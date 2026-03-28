# Hackathon

## Stack

- **Backend**: [InsForge](https://insforge.com) (Database, Auth, Storage, AI, Functions, Realtime)
- **AI Coding Assistants**: Claude Code, Qoder

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Zuriahn-Yun/Hackathon.git
cd Hackathon
```

### 2. Link InsForge

This installs agent skills and generates your personal `.mcp.json` and `.insforge/` config:

```bash
npx @insforge/cli link --project-id 8e2b49ec-353d-4365-bc07-f061696a90cf
```

> Your `.mcp.json` contains a personal API key — it is gitignored and stays local to your machine.

---

## AI Coding Assistants

### Claude Code

After running the link command above, Claude Code will automatically pick up the InsForge MCP server from `.mcp.json` and the agent skills from `skills-lock.json`.

### Qoder

1. Run the InsForge link command above (installs skills into `.qoder/skills/` automatically).
2. Add the InsForge MCP server to Qoder's MCP settings. Use `.mcp.json.example` as a reference — copy it to `.mcp.json` if it wasn't created automatically, then replace `YOUR_API_KEY` with your key from `.insforge/project.json`.

```bash
cp .mcp.json.example .mcp.json
# Then edit .mcp.json and replace YOUR_API_KEY
```

---

## InsForge Backend

| Service   | Details                                          |
|-----------|--------------------------------------------------|
| URL       | `https://66wjtrxb.us-west.insforge.app`          |
| Region    | `us-west`                                        |
| Project   | `8e2b49ec-353d-4365-bc07-f061696a90cf`           |

### SDK

```bash
npm install @insforge/sdk@latest
```

```javascript
import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://66wjtrxb.us-west.insforge.app',
  anonKey: 'your-anon-key'  // from npx @insforge/cli get-metadata
});
```

> Get your anon key: `npx @insforge/cli get-metadata --project-id 8e2b49ec-353d-4365-bc07-f061696a90cf`

---

## Agent Skills

Skills are tracked in `skills-lock.json`. The InsForge link command installs them automatically. Installed skills:

- **insforge** — frontend SDK integration (auth, database, storage, AI, realtime)
- **insforge-cli** — backend infrastructure (tables, functions, deployments, buckets)
- **find-skills** — skill discovery
