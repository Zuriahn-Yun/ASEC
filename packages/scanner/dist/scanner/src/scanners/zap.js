import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
const execAsync = promisify(exec);
export async function runZap(targetUrl) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zap-'));
    const reportPath = path.join(tempDir, 'zap-report.json');
    try {
        try {
            await execAsync('docker --version');
        }
        catch {
            console.warn('[DAST] Docker is not available, skipping ZAP scan.');
            return [];
        }
        const dockerTargetUrl = getDockerReachableUrl(targetUrl);
        const dockerCommand = [
            'docker run --rm',
            '--add-host=host.docker.internal:host-gateway',
            `-v "${tempDir}:/zap/wrk/:rw"`,
            'ghcr.io/zaproxy/zaproxy:stable',
            `zap-baseline.py -t "${dockerTargetUrl}" -J /zap/wrk/zap-report.json`,
        ].join(' ');
        console.log(`Starting ZAP scan against ${dockerTargetUrl}...`);
        try {
            await execAsync(dockerCommand, {
                timeout: 10 * 60 * 1000,
                maxBuffer: 50 * 1024 * 1024,
            });
        }
        catch {
            // ZAP exits non-zero when it finds issues. We still parse the report.
            console.log('ZAP scan completed with findings or warnings.');
        }
        try {
            await fs.access(reportPath);
        }
        catch {
            console.warn('ZAP report was not generated, returning an empty result set.');
            return [];
        }
        const reportContent = await fs.readFile(reportPath, 'utf-8');
        const report = JSON.parse(reportContent);
        const findings = [];
        const riskCodeToSeverity = {
            '3': 'critical',
            '2': 'high',
            '1': 'medium',
            '0': 'low',
        };
        for (const site of report.site || []) {
            for (const alert of site.alerts || []) {
                const severity = riskCodeToSeverity[alert.riskcode] || 'info';
                let description = alert.desc || '';
                if (alert.solution) {
                    description += `\n\nSolution: ${alert.solution}`;
                }
                if (alert.otherinfo) {
                    description += `\n\nOther Info: ${alert.otherinfo}`;
                }
                if (alert.reference) {
                    description += `\n\nReference: ${alert.reference}`;
                }
                findings.push({
                    scan_id: '',
                    scanner: 'zap',
                    scan_type: 'dast',
                    severity,
                    title: alert.name || alert.alert,
                    description: description.trim(),
                    file_path: alert.instances?.[0]?.uri,
                    cwe_id: alert.cweid,
                    rule_id: alert.pluginid,
                    raw_sarif: {
                        confidence: alert.confidence,
                        wascid: alert.wascid,
                        alertRef: alert.alertRef,
                        instance_count: parseInt(alert.count, 10) || 0,
                        instances: alert.instances,
                    },
                });
            }
        }
        console.log(`ZAP scan found ${findings.length} issues`);
        return findings;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('timeout')) {
            console.error('ZAP scan timed out after 10 minutes');
            return [];
        }
        console.error('ZAP scan failed:', error);
        return [];
    }
    finally {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors.
        }
    }
}
function getDockerReachableUrl(targetUrl) {
    const url = new URL(targetUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = 'host.docker.internal';
    }
    return url.toString();
}
