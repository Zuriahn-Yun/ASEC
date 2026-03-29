import { execFile, spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { Socket, createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { DetectionResult } from './detect.js';
import { runNpm } from './npm.js';

const execFileAsync = promisify(execFile);
const HEALTH_CHECK_INTERVAL_MS = 2000;
const HEALTH_CHECK_TIMEOUT_MS = 180_000;
const LOG_LIMIT = 12_000;

type BootedChild = ChildProcessByStdio<null, Readable, Readable>;

const runningApps = new Map<string, { child: BootedChild; logs: string }>();

export async function bootApp(
  repoDir: string,
  detection: DetectionResult,
): Promise<{ containerId: string; appUrl: string }> {
  if (!detection.startCommand) {
    throw new Error('Cannot boot app: no start command detected');
  }

  if (detection.runtime !== 'node') {
    throw new Error(`Cannot boot app: unsupported runtime ${detection.runtime}`);
  }

  const appDir = detection.workdir === '.' ? repoDir : join(repoDir, detection.workdir);
  await installNodeDependencies(appDir);

  const requestedPort = await getAvailablePort();
  const candidatePorts = await getCandidatePorts(requestedPort, detection.port);
  const startCommand = buildStartCommand(detection, requestedPort);
  const child = spawn(
    process.platform === 'win32' ? 'cmd.exe' : 'sh',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', startCommand]
      : ['-lc', startCommand],
    {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(requestedPort),
      HOST: '0.0.0.0',
      HOSTNAME: '0.0.0.0',
      BROWSER: 'none',
      CI: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    },
  );

  const handle = `pid:${child.pid}`;
  const state = { child, logs: '' };
  runningApps.set(handle, state);

  child.stdout.on('data', (chunk) => appendLogs(state, chunk));
  child.stderr.on('data', (chunk) => appendLogs(state, chunk));

  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`App process exited before becoming healthy.\nLogs:\n${state.logs}`.trim());
    }

    for (const port of candidatePorts) {
      const appUrl = `http://127.0.0.1:${port}`;
      const healthy = await fetch(appUrl).then(() => true).catch(() => false);
      if (healthy) {
        console.log(`[BOOT] App healthy at ${appUrl}`);
        return { containerId: handle, appUrl };
      }
    }

    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  await stopApp(handle).catch(() => undefined);
  throw new Error(
    `App did not become healthy on any expected port within ${HEALTH_CHECK_TIMEOUT_MS / 1000}s` +
      (state.logs ? `\nLogs:\n${state.logs}` : ''),
  );
}

export async function stopApp(containerId: string): Promise<void> {
  if (!containerId.startsWith('pid:')) {
    return;
  }

  const state = runningApps.get(containerId);
  const pid = Number(containerId.slice(4));

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']).catch(() => undefined);
  } else {
    state?.child.kill('SIGTERM');
  }

  runningApps.delete(containerId);
}

async function installNodeDependencies(appDir: string): Promise<void> {
  if (existsSync(join(appDir, 'node_modules'))) {
    console.log('[BOOT] node_modules exists, skipping install');
    return;
  }

  const hasLockfile = existsSync(join(appDir, 'package-lock.json'));
  const args = hasLockfile
    ? ['ci', '--no-audit', '--no-fund']
    : ['install', '--no-audit', '--no-fund'];

  console.log(`[BOOT] Installing dependencies (npm ${args[0]}) in ${appDir}...`);
  const start = Date.now();
  await runNpm(args, { cwd: appDir, timeout: 300_000, maxBuffer: 50 * 1024 * 1024 });
  console.log(`[BOOT] Dependencies installed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

function buildStartCommand(detection: DetectionResult, port: number): string {
  if (detection.framework === 'nextjs' && detection.startCommand === 'npm run dev') {
    return `npm run dev -- --hostname 0.0.0.0 --port ${port}`;
  }

  if (detection.framework === 'nextjs' && detection.startCommand === 'npm start') {
    return `npm start -- --hostname 0.0.0.0 --port ${port}`;
  }

  if (detection.framework === 'vite' && detection.startCommand === 'npm run dev') {
    return `npm run dev -- --host 0.0.0.0 --port ${port}`;
  }

  if (detection.framework === 'vite' && detection.startCommand === 'npm run preview') {
    return `npm run preview -- --host 0.0.0.0 --port ${port}`;
  }

  return detection.startCommand;
}

async function getCandidatePorts(requestedPort: number, detectedPort: number): Promise<number[]> {
  const fallbackPorts = Array.from(new Set([detectedPort, 3000, 4000, 4173, 5000, 5173, 7777, 8000, 8080]))
    .filter((port) => port !== requestedPort);
  const availability = await Promise.all(
    fallbackPorts.map(async (port) => ({ port, busy: await isPortBusy(port) })),
  );

  return [requestedPort, ...availability.filter((entry) => !entry.busy).map((entry) => entry.port)];
}

function isPortBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    resolveUsingConnection(socket, port, resolve);
  });
}

function resolveUsingConnection(socket: Socket, port: number, resolve: (value: boolean) => void): void {
  const done = (value: boolean) => {
    socket.removeAllListeners();
    socket.destroy();
    resolve(value);
  };

  socket.setTimeout(1000);
  socket.once('connect', () => done(true));
  socket.once('timeout', () => done(false));
  socket.once('error', () => done(false));
  socket.connect(port, '127.0.0.1');
}

function appendLogs(state: { logs: string }, chunk: Buffer | string): void {
  state.logs += chunk.toString();
  if (state.logs.length > LOG_LIMIT) {
    state.logs = state.logs.slice(-LOG_LIMIT);
  }
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a free port')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
