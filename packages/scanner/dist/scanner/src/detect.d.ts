export interface DetectionResult {
    framework: 'express' | 'nextjs' | 'react' | 'vite' | 'django' | 'flask' | 'spring' | 'unknown';
    runtime: 'node' | 'python' | 'java' | 'unknown';
    startCommand: string;
    port: number;
    workdir: string;
}
export declare function detectFramework(repoDir: string): Promise<DetectionResult>;
