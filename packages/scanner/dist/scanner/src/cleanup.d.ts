/**
 * Removes the cloned temp directory and optionally stops a Docker container.
 */
export declare function cleanup(repoDir: string, containerId?: string): Promise<void>;
