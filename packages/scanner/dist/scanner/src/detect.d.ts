export interface DetectionResult {
    framework: 'express' | 'nextjs' | 'django' | 'flask' | 'spring' | 'unknown';
    runtime: 'node' | 'python' | 'java' | 'unknown';
    startCommand: string;
    port: number;
}
export declare function detectFramework(repoDir: string): Promise<DetectionResult>;
