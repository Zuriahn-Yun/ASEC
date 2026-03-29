import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
/**
 * Clones a public GitHub repo into a temporary directory.
 * @returns Absolute path to the cloned directory.
 */
export async function cloneRepo(repoUrl, branch) {
    const repoDir = await mkdtemp(join(tmpdir(), 'scanner-'));
    const args = ['clone', '--depth', '1'];
    if (branch) {
        args.push('--branch', branch);
    }
    args.push(repoUrl, repoDir);
    console.log(`[CLONE] Cloning ${repoUrl} (branch: ${branch || 'default'})...`);
    const start = Date.now();
    await execFileAsync('git', args, { shell: USE_SHELL, timeout: 120_000 });
    console.log(`[CLONE] Cloned in ${((Date.now() - start) / 1000).toFixed(1)}s -> ${repoDir}`);
    return repoDir;
}
