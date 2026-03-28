import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
const execFileAsync = promisify(execFile);
const USE_SHELL = process.platform === 'win32';
function mapNpmSeverity(severity) {
    switch (severity) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'moderate': return 'medium';
        case 'low': return 'low';
        case 'info': return 'info';
        default: return 'medium';
    }
}
export async function runNpmAudit(repoDir, scanId) {
    // Only run if package-lock.json or package.json exists
    const hasPackageJson = existsSync(join(repoDir, 'package.json'));
    if (!hasPackageJson) {
        console.warn('[npm-audit] No package.json found, skipping');
        return [];
    }
    try {
        // npm audit exits with code 1 when vulnerabilities are found -- that's expected
        let stdout;
        try {
            const result = await execFileAsync('npm', ['audit', '--json'], {
                cwd: repoDir,
                timeout: 120_000, // 2 min
                maxBuffer: 50 * 1024 * 1024,
                shell: USE_SHELL,
            });
            stdout = result.stdout;
        }
        catch (err) {
            // npm audit exits 1 when vulns found -- grab stdout from the error
            if (err && typeof err === 'object' && 'stdout' in err) {
                stdout = err.stdout;
            }
            else {
                throw err;
            }
        }
        const report = JSON.parse(stdout);
        const findings = [];
        for (const [pkgName, vuln] of Object.entries(report.vulnerabilities ?? {})) {
            // Extract CWE from via entries
            let cweId;
            let description = '';
            if (Array.isArray(vuln.via)) {
                for (const v of vuln.via) {
                    if (typeof v === 'object' && v !== null) {
                        if (v.cwe && v.cwe.length > 0) {
                            cweId = v.cwe[0];
                        }
                        if (v.title) {
                            description = v.title;
                        }
                    }
                }
            }
            const title = vuln.title ?? description ?? `Vulnerable dependency: ${pkgName}`;
            findings.push({
                scan_id: scanId,
                scanner: 'npm_audit',
                scan_type: 'sca',
                severity: mapNpmSeverity(vuln.severity),
                title: `${title} (${pkgName})`,
                description: description || `Package ${pkgName} has a known ${vuln.severity} severity vulnerability. Range: ${vuln.range ?? 'unknown'}`,
                file_path: 'package.json',
                line_start: undefined,
                line_end: undefined,
                cwe_id: cweId,
                rule_id: pkgName,
                raw_sarif: vuln,
            });
        }
        return findings;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('ENOENT') || message.includes('not found') || message.includes('not recognized')) {
            console.warn('[SCA] npm not found in PATH — skipping npm audit. Install: https://nodejs.org/en/download/');
            return [];
        }
        if (message.includes('TIMEOUT') || message.includes('timed out')) {
            console.warn('[npm-audit] Timed out after 2 minutes');
            return [];
        }
        console.error('[npm-audit] Scan failed:', message);
        return [];
    }
}
