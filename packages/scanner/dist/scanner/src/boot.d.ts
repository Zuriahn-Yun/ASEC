import type { DetectionResult } from './detect.js';
export declare function bootApp(repoDir: string, detection: DetectionResult): Promise<{
    containerId: string;
    appUrl: string;
}>;
export declare function stopApp(containerId: string): Promise<void>;
