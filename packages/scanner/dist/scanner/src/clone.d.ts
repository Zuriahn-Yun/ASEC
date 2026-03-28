/**
 * Clones a public GitHub repo into a temporary directory.
 * @returns Absolute path to the cloned directory.
 */
export declare function cloneRepo(repoUrl: string, branch?: string): Promise<string>;
