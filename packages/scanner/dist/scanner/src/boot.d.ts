import type { DetectionResult } from './detect.js';
/**
 * Boots the target app in a Docker container.
 * The container installs dependencies first so DAST can run against a fresh clone.
 * A free host port is chosen dynamically to avoid collisions with the frontend.
 */
export declare function bootApp(repoDir: string, detection: DetectionResult): Promise<{
    containerId: string;
    appUrl: string;
}>;
export declare function stopApp(containerId: string): Promise<void>;
