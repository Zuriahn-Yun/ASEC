import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';
import type { DetectionResult } from './detect.js';

const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';

const HEALTH_CHECK_INTERVAL_MS = 2000;
const HEALTH_CHECK_TIMEOUT_MS = 60_000;

/**
 * Boots the target app in a Docker container.
 * The container installs dependencies first so DAST can run against a fresh clone.
 * A free host port is chosen dynamically to avoid collisions with the frontend.
 */
export async function bootApp(
  repoDir: string,
  detection: DetectionResult,
): Promise<{ containerId: string; appUrl: string }> {
  if (!detection.startCommand) {
    throw new Error('Cannot boot app: no start command detected');
  }

  const containerPort = detection.port;
  const hostPort = await getAvailablePort();
  const image = detection.runtime === 'python' ? 'python:3.11-slim' : 'node:20-slim';
  const containerCommand = buildContainerCommand(detection, containerPort);

  const { stdout } = await execFileAsync(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--workdir', '/app',
      '--volume', `${repoDir}:/app`,
      '--publish', `${hostPort}:${containerPort}`,
      '--env', `PORT=${containerPort}`,
      '--env', 'HOST=0.0.0.0',
      '--env', 'HOSTNAME=0.0.0.0',
      image,
      'sh',
      '-lc',
      containerCommand,
    ],
    { shell: USE_SHELL },
  );

  const containerId = stdout.trim();
  const appUrl = `http://localhost:${hostPort}`;
  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const healthy = await fetch(appUrl).then(() => true).catch(() => false);
    if (healthy) {
      return { containerId, appUrl };
    }
    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  await stopApp(containerId).catch(() => undefined);
  throw new Error(`App at ${appUrl} did not become healthy within ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`);
}

export async function stopApp(containerId: string): Promise<void> {
  await execFileAsync('docker', ['stop', containerId], { shell: USE_SHELL });
}

function buildContainerCommand(detection: DetectionResult, port: number): string {
  const steps: string[] = [];

  if (detection.runtime === 'node') {
    steps.push('if [ -f package-lock.json ]; then npm ci; else npm install; fi');
  }

  if (detection.runtime === 'python') {
    steps.push('pip install --no-cache-dir -r requirements.txt');
  }

  steps.push(adaptStartCommand(detection.startCommand, port));
  return steps.join(' && ');
}

function adaptStartCommand(startCommand: string, port: number): string {
  if (startCommand === 'npm run dev') {
    return `npm run dev -- --host 0.0.0.0 --port ${port}`;
  }

  if (startCommand === 'npm run preview') {
    return `npm run preview -- --host 0.0.0.0 --port ${port}`;
  }

  return startCommand;
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
