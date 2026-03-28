import { rm } from 'node:fs/promises';
import { stopApp } from './boot.js';

/**
 * Removes the cloned temp directory and optionally stops a Docker container.
 */
export async function cleanup(repoDir: string, containerId?: string): Promise<void> {
  await Promise.allSettled([
    rm(repoDir, { recursive: true, force: true }),
    containerId ? stopApp(containerId) : Promise.resolve(),
  ]);
}
