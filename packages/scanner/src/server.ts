import 'dotenv/config';
import express, { Request, Response } from 'express';
import { runPipeline } from './orchestrator.js';

// Validate required env vars before starting — fail fast with a clear message
const REQUIRED_ENV = ['INSFORGE_BASE_URL', 'INSFORGE_ANON_KEY'] as const;

for (const key of REQUIRED_ENV) {
  const value = process.env[key] || process.env[`NEXT_PUBLIC_${key}`];
  if (!value) {
    console.error(`ERROR: Missing required env var: ${key} (or NEXT_PUBLIC_${key})`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
});

// JSON body parsing
app.use(express.json());

interface ScanTriggerRequest {
  scan_id: string;
  repo_url: string;
  branch?: string;
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Scan trigger endpoint
app.post('/scan', (req: Request, res: Response) => {
  const body: ScanTriggerRequest = req.body;

  // Validate required fields
  if (!body.scan_id) {
    res.status(400).json({ error: 'scan_id is required' });
    return;
  }

  if (!body.repo_url) {
    res.status(400).json({ error: 'repo_url is required' });
    return;
  }

  // Fire-and-forget: start pipeline without awaiting
  runPipeline({
    id: body.scan_id,
    repo_url: body.repo_url,
    branch: body.branch || 'main',
  }).catch((err) => {
    console.error('Pipeline failed:', err);
  });

  // Return immediately with started status
  res.json({
    status: 'started',
    scan_id: body.scan_id,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Scanner HTTP server listening on port ${PORT}`);
});
