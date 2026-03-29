import { exec, execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
export async function runNuclei(targetUrl) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuclei-'));
    const outputPath = path.join(tempDir, 'nuclei.jsonl');
    try {
        try {
            await execFileAsync('docker', ['--version']);
        }
        catch {
            console.warn('[DAST] Docker is not available, skipping Nuclei scan.');
            return [];
        }
        const dockerTargetUrl = getDockerReachableUrl(targetUrl);
        console.log(`Starting Nuclei scan against ${dockerTargetUrl}...`);
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
                '-jsonl',
                '-silent',
                '-severity',
                'critical,high,medium,low',
                '-o',
                '/work/nuclei.jsonl',
            ], {
                timeout: 5 * 60 * 1000,
                maxBuffer: 50 * 1024 * 1024,
            });
        }
        catch {
            console.log('Nuclei scan completed with findings or warnings.');
        }
        const output = await fs.readFile(outputPath, 'utf-8').catch(() => '');
        if (!output.trim()) {
            return [];
        }
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
                if (result.info.classification?.cwe_id) {
                    const cwe = result.info.classification.cwe_id;
                    cweId = Array.isArray(cwe) ? cwe[0] : cwe;
                }
                let description = result.info.description || '';
                if (result.extracted_results?.length) {
                    description += `\n\nExtracted: ${result.extracted_results.join(', ')}`;
                }
                if (result.curl_command) {
                    description += `\n\nCurl: ${result.curl_command}`;
                }
                findings.push({
                    scan_id: '',
                    scanner: 'nuclei',
                    scan_type: 'dast',
                    severity: severityMap[result.info.severity.toLowerCase()] || 'info',
                    title: result.info.name,
                    description: description.trim(),
                    file_path: result.matched_at,
                    cwe_id: cweId,
                    rule_id: result.template_id,
                });
            }
            catch (parseError) {
                console.warn('Failed to parse a Nuclei output line:', parseError);
            }
        }
        return findings;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
            console.error('Nuclei scan timed out after 5 minutes');
            return [];
        }
        console.error('Nuclei scan failed:', error);
        return [];
    }
    finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
function getDockerReachableUrl(targetUrl) {
    const url = new URL(targetUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = 'host.docker.internal';
    }
    return url.toString();
}
