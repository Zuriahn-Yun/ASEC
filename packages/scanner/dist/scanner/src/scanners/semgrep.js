import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
const SEMGREP_TIMEOUT_MS = 15 * 60 * 1000;
function mapLevel(level) {
    switch (level) {
        case 'error':
            return 'high';
        case 'warning':
            return 'medium';
        case 'note':
            return 'low';
        default:
            return 'info';
    }
}
export async function runSemgrep(repoDir) {
    const stdout = await runLocalSemgrep(repoDir) ?? await runDockerSemgrep(repoDir);
    if (!stdout) {
        return [];
    }
    let sarif;
    try {
        sarif = JSON.parse(stdout);
    }
    catch {
        return [];
    }
    const results = sarif.runs?.[0]?.results ?? [];
    return results.map((result) => {
        const location = result.locations?.[0]?.physicalLocation;
        return {
            scan_id: '',
            scanner: 'semgrep',
            scan_type: 'sast',
            severity: mapLevel(result.level),
            title: result.ruleId ?? 'semgrep finding',
            description: result.message?.text,
            file_path: location?.artifactLocation?.uri,
            line_start: location?.region?.startLine,
            line_end: location?.region?.endLine,
            rule_id: result.ruleId,
            raw_sarif: result,
        };
    });
}
async function runLocalSemgrep(repoDir) {
    try {
        const result = await execFileAsync('semgrep', ['scan', '--config', 'auto', '--sarif', '--quiet', repoDir], { maxBuffer: 50 * 1024 * 1024, timeout: SEMGREP_TIMEOUT_MS, shell: USE_SHELL });
        return result.stdout;
    }
    catch (error) {
        const execError = error;
        if (execError.stdout) {
            return execError.stdout;
        }
    }
    return null;
}
async function runDockerSemgrep(repoDir) {
    try {
        await execAsync('docker --version');
    }
    catch {
        console.warn('[SAST] Semgrep is unavailable and Docker is not installed.');
        return null;
    }
    const command = [
        'docker run --rm',
        `-v "${repoDir}:/src"`,
        'returntocorp/semgrep',
        'semgrep scan --config auto --sarif --quiet /src',
    ].join(' ');
    try {
        const { stdout } = await execAsync(command, {
            timeout: SEMGREP_TIMEOUT_MS,
            maxBuffer: 50 * 1024 * 1024,
        });
        return stdout;
    }
    catch (error) {
        const execError = error;
        if (execError.stdout) {
            return execError.stdout;
        }
        console.warn('[SAST] Dockerized Semgrep scan failed:', error);
        return null;
    }
}
