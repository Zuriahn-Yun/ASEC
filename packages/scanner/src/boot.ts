import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DetectionResult } from './detect.js';

const execFileAsync = promisify(execFile);

const HEALTH_CHECK_INTERVAL_MS = 2000;
const HEALTH_CHECK_TIMEOUT_MS = 60_000;

/**
 * Boots the target app in a Docker container.
 * @returns containerId and the local URL the app is reachable at.
 */
export async function bootApp(
  repoDir: string,
  detection: DetectionResult,
): Promise<{ containerId: string; appUrl: string }> {
  if (!detection.startCommand) {
    throw new Error('Cannot boot app: no start command detected');
  }

  const { port, startCommand, runtime } = detection;
  const image = runtime === 'python' ? 'python:3.11-slim' : 'node:20-slim';

  const { stdout } = await execFileAsync('docker', [
    'run',
    '--detach',
    '--rm',
    '--workdir', '/app',
    '--volume', `${repoDir}:/app`,
    '--publish', `${port}:${port}`,
    image,
    'sh', '-c', startCommand,
  ]);

  const containerId = stdout.trim();

  // Poll until the app responds or timeout is reached
  const appUrl = `http://localhost:${port}`;
  const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const healthy = await fetch(appUrl).then(() => true).catch(() => false);
    if (healthy) {
      return { containerId, appUrl };
    }
    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  // Timed out — stop the container and throw so the pipeline can skip DAST
  await stopApp(containerId).catch(() => undefined);
  throw new Error(`App at ${appUrl} did not become healthy within ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`);
}

/**
 * Stops a running Docker container.
 */
export async function stopApp(containerId: string): Promise<void> {
  await execFileAsync('docker', ['stop', containerId]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
