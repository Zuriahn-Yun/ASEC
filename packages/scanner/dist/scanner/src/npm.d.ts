interface RunNpmOptions {
    cwd: string;
    timeout: number;
    maxBuffer?: number;
}
export declare function runNpm(args: string[], options: RunNpmOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function getNpmExecutable(): string;
export {};
