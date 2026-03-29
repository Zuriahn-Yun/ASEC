import { existsSync } from 'fs';
import { join } from 'path';
import { runNpm } from '../npm.js';
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
    if (!existsSync(join(repoDir, 'package.json'))) {
        console.warn('[npm-audit] No package.json found, skipping');
        return [];
    }
    try {
        let stdout;
        try {
            const result = await runNpm(['audit', '--json'], {
                cwd: repoDir,
                timeout: 60_000,
                maxBuffer: 50 * 1024 * 1024,
            });
            stdout = result.stdout;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'stdout' in error) {
                stdout = String(error.stdout ?? '');
            }
            else {
                throw error;
            }
        }
        if (!stdout.trim()) {
            return [];
        }
        const report = JSON.parse(stdout);
        const findings = [];
        for (const [pkgName, vuln] of Object.entries(report.vulnerabilities ?? {})) {
            let cweId;
            let description = '';
            if (Array.isArray(vuln.via)) {
                for (const viaEntry of vuln.via) {
                    if (typeof viaEntry === 'object' && viaEntry !== null) {
                        if (viaEntry.cwe && viaEntry.cwe.length > 0) {
                            cweId = viaEntry.cwe[0];
                        }
                        if (viaEntry.title) {
                            description = viaEntry.title;
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
                description: description ||
                    `Package ${pkgName} has a known ${vuln.severity} severity vulnerability. Range: ${vuln.range ?? 'unknown'}`,
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
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('ENOENT') || message.includes('not found') || message.includes('not recognized')) {
            console.warn('[SCA] npm is unavailable for npm audit, skipping.');
            return [];
        }
        if (message.toLowerCase().includes('timed out')) {
            console.warn('[npm-audit] Timed out after 60 seconds');
            return [];
        }
        console.error('[npm-audit] Scan failed:', message);
        return [];
    }
}
