import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
// 4 minutes — focused template set (technologies + misconfiguration + exposures) completes well within this.
const NUCLEI_TIMEOUT_MS = 4 * 60 * 1000;
// Fast, high-signal template paths — avoids the thousands of CVE templates that stall demo scans.
// http/technologies  → detect what's running (bounded, fast)
// http/misconfiguration → common misconfig patterns
// http/exposures     → exposed files, panels, credentials
const NUCLEI_TEMPLATE_DIRS = [
    'http/technologies/',
    'http/misconfiguration/',
    'http/exposures/',
];
/** Returns true when the target responds to a basic HTTP probe within 5 s. */
async function isTargetReachable(targetUrl) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(targetUrl, { signal: controller.signal, method: 'HEAD' }).catch(() => fetch(targetUrl, { signal: controller.signal }));
        clearTimeout(timer);
        return res.status < 600;
    }
    catch {
        return false;
    }
}
export async function runNuclei(targetUrl) {
    // Pre-flight: skip scan if the target isn't reachable — nuclei will stall
    // waiting on connection timeouts for every template (can be thousands).
    console.log(`[DAST] Checking Nuclei target reachability: ${targetUrl}`);
    const reachable = await isTargetReachable(targetUrl);
    if (!reachable) {
        console.warn(`[DAST] Nuclei target ${targetUrl} is unreachable — skipping scan.`);
        return [];
    }
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuclei-'));
    // Ensure the Docker container user can write the output file.
    await fs.chmod(tempDir, 0o777);
    const outputPath = path.join(tempDir, 'nuclei.jsonl');
    try {
        const start = Date.now();
        const output = await runLocalNuclei(targetUrl, outputPath) ?? await runDockerNuclei(targetUrl, tempDir, outputPath);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        if (!output || !output.trim()) {
            console.log(`[DAST] Nuclei produced no output (${elapsed}s)`);
            return [];
        }
        const findings = parseNucleiOutput(output);
        console.log(`[DAST] Nuclei found ${findings.length} findings in ${elapsed}s`);
        return findings;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
            console.error(`[DAST] Nuclei scan timed out after ${NUCLEI_TIMEOUT_MS / 60000} minutes`);
            return [];
        }
        console.error('[DAST] Nuclei scan failed:', error);
        return [];
    }
    finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
async function runLocalNuclei(targetUrl, _outputPath) {
    try {
        await execFileAsync('nuclei', ['-version'], { timeout: 5000, shell: USE_SHELL });
    }
    catch {
        console.log('[DAST] Local Nuclei not available, falling back to Docker');
        return null;
    }
    // Use -j (stdout JSON lines) instead of -jle (output file).
    // -jle only writes on clean process exit — if execFileAsync rejects (non-zero exit code),
    // the file is never created. -j writes to stdout which execFileAsync captures regardless
    // of exit code (available via error.stdout in the catch branch).
    console.log(`[DAST] Running local Nuclei against ${targetUrl}...`);
    try {
        const { stdout } = await execFileAsync('nuclei', [
            '-u', targetUrl,
            '-j', // write JSONL to stdout
            '-silent',
            // Skip automatic update check — without this, nuclei spends 2-6 minutes
            // pulling template updates before it starts scanning. Critical for demos.
            '-duc',
            // Include info+low: HTTP missing-security-headers findings are severity=info.
            '-severity', 'critical,high,medium,low,info',
            // 'headers' = 6 focused templates (fast, confirmed findings on web apps).
            // 'cors' = 2 templates. Avoid 'xss' (1175) and 'misconfig' (906) — too slow.
            '-tags', 'headers,cors',
            '-timeout', '10', // per-request timeout in seconds
            '-rl', '100', // rate limit requests per second
            '-c', '25', // concurrent requests
        ], {
            timeout: NUCLEI_TIMEOUT_MS,
            maxBuffer: 50 * 1024 * 1024,
            shell: USE_SHELL,
        });
        return stdout || null;
    }
    catch (error) {
        const execError = error;
        if (execError.stdout) {
            // nuclei exits non-zero when findings exist — stdout still contains the JSONL.
            return execError.stdout;
        }
        console.log('[DAST] Nuclei scan completed (may have findings or warnings)');
    }
    return null;
}
async function runDockerNuclei(targetUrl, tempDir, outputPath) {
    try {
        await execFileAsync('docker', ['--version']);
    }
    catch {
        console.warn('[DAST] Docker is not available, skipping Nuclei scan.');
        return null;
    }
    // Pre-pull the image so scan time isn't eaten by the Docker registry download.
    // Use --quiet to avoid filling logs; ignore failures (image may already be cached).
    console.log('[DAST] Pre-pulling Nuclei Docker image...');
    await execFileAsync('docker', ['pull', '--quiet', 'projectdiscovery/nuclei:latest'], {
        timeout: 5 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
    }).catch((err) => console.warn('[DAST] Nuclei image pull warning:', err.message));
    const dockerTargetUrl = getDockerReachableUrl(targetUrl);
    console.log(`[DAST] Running Dockerized Nuclei against ${dockerTargetUrl}...`);
    try {
        await execFileAsync('docker', [
            'run',
            '--rm',
            '--add-host=host.docker.internal:host-gateway',
            '-v',
            `${tempDir}:/work:rw`,
            'projectdiscovery/nuclei:latest',
            '-u',
            dockerTargetUrl,
            '-jle', '/work/nuclei.jsonl',
            '-duc',
            '-silent',
            '-severity', 'critical,high,medium,low,info',
            // 'headers' = 6 templates (fast, high-yield); 'cors' = 2; 'generic' is small.
            // Avoid 'xss' (1175 templates) — blows the timeout window.
            '-tags', 'headers,cors,generic',
            '-timeout', '15',
            '-rl', '100',
            '-c', '25',
        ], {
            timeout: NUCLEI_TIMEOUT_MS,
            maxBuffer: 50 * 1024 * 1024,
        });
    }
    catch {
        console.log('[DAST] Nuclei scan completed (may have findings or warnings)');
    }
    return fs.readFile(outputPath, 'utf-8').catch(() => '');
}
function parseNucleiOutput(output) {
    const findings = [];
    const lines = output.trim().split('\n').filter((line) => line.trim());
    for (const line of lines) {
        try {
            const result = JSON.parse(line);
            const severityMap = {
                critical: 'critical',
                high: 'high',
                medium: 'medium',
                low: 'low',
                info: 'info',
            };
            let cweId;
            if (result.info.classification?.['cwe-id']) {
                const cwe = result.info.classification['cwe-id'];
                cweId = Array.isArray(cwe) ? cwe[0] : cwe;
            }
            let description = result.info.description || '';
            if (result['extracted-results']?.length) {
                description += `\n\nExtracted: ${result['extracted-results'].join(', ')}`;
            }
            if (result['curl-command']) {
                description += `\n\nCurl: ${result['curl-command']}`;
            }
            findings.push({
                scan_id: '',
                scanner: 'nuclei',
                scan_type: 'dast',
                severity: severityMap[result.info.severity.toLowerCase()] || 'info',
                title: result.info.name,
                description: description.trim(),
                file_path: result['matched-at'],
                cwe_id: cweId,
                rule_id: result['template-id'],
            });
        }
        catch (parseError) {
            console.warn('[DAST] Failed to parse a Nuclei output line:', parseError);
        }
    }
    return findings;
}
function getDockerReachableUrl(targetUrl) {
    const url = new URL(targetUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = 'host.docker.internal';
    }
    return url.toString();
}
