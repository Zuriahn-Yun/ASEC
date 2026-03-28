import { cloneRepo } from './clone.js';
import { detectFramework } from './detect.js';
import { bootApp, stopApp } from './boot.js';
import { cleanup } from './cleanup.js';
import { runSemgrep } from './scanners/semgrep.js';
import { runZap } from './scanners/zap.js';
import { runNuclei } from './scanners/nuclei.js';
import { runTrivy } from './scanners/trivy.js';
import { runNpmAudit } from './scanners/npm-audit.js';
import { triageFindings, generateFixes, generateExplanations } from './ai-analyzer.js';
import { updateScanStatus, updateScanMetadata, insertFindings, insertFixes, computeSummary, updateFindingDescriptions } from './reporter.js';
import { createClient } from '@insforge/sdk';
import { checkTools } from './tool-check.js';
const insforge = createClient({
    baseUrl: process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
    anonKey: process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '',
});
export async function runPipeline(job) {
    let repoDir;
    const types = {
        sast: job.scan_types?.sast !== false,
        dast: job.scan_types?.dast !== false,
        sca: job.scan_types?.sca !== false,
    };
    const scannerResults = {
        semgrep: null,
        zap: null,
        nuclei: null,
        trivy: null,
        npmAudit: null,
    };
    try {
        const tools = await checkTools();
        console.log('=== Scanner Tool Availability ===');
        for (const t of tools) {
            console.log(`  ${t.name}: ${t.available ? '\u2713 (' + t.version + ')' : '\u2717 NOT FOUND'}`);
        }
        await updateScanStatus(job.id, 'cloning');
        repoDir = await cloneRepo(job.repo_url, job.branch);
        await updateScanStatus(job.id, 'detecting');
        const detection = await detectFramework(repoDir);
        await updateScanMetadata(job.id, { framework: detection.framework });
        const [sastCount, dastResults, scaResults] = await Promise.all([
            runSastWorkflow(job.id, repoDir, types.sast),
            runDastWorkflow(job.id, repoDir, detection, types.dast),
            runScaWorkflow(job.id, repoDir, types.sca),
        ]);
        scannerResults.semgrep = sastCount;
        scannerResults.zap = dastResults.zap;
        scannerResults.nuclei = dastResults.nuclei;
        scannerResults.trivy = scaResults.trivy;
        scannerResults.npmAudit = scaResults.npmAudit;
        await runAiAnalysis(job.id, repoDir);
        logScannerSummary(scannerResults);
        await finalizeReport(job.id);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateScanStatus(job.id, 'failed', errorMessage);
        throw error;
    }
    finally {
        if (repoDir) {
            await cleanup(repoDir).catch(() => undefined);
        }
    }
}
async function runSast(scanId, repoDir) {
    await updateScanStatus(scanId, 'scanning_sast');
    const findings = await runSemgrep(repoDir);
    const findingsWithScanId = findings.map((finding) => ({ ...finding, scan_id: scanId }));
    await insertFindings(scanId, findingsWithScanId);
    return findings.length;
}
async function runSastWorkflow(scanId, repoDir, enabled) {
    if (!enabled) {
        console.log('[SAST] Skipped (disabled by user)');
        return null;
    }
    return runSast(scanId, repoDir);
}
async function runDast(scanId, appUrl) {
    await updateScanStatus(scanId, 'scanning_dast');
    const [zapResult, nucleiResult] = await Promise.allSettled([
        runZap(appUrl),
        runNuclei(appUrl),
    ]);
    const zapFindings = zapResult.status === 'fulfilled' ? zapResult.value : [];
    const nucleiFindings = nucleiResult.status === 'fulfilled' ? nucleiResult.value : [];
    if (zapResult.status === 'rejected') {
        console.error('ZAP scan failed:', zapResult.reason);
    }
    if (nucleiResult.status === 'rejected') {
        console.error('Nuclei scan failed:', nucleiResult.reason);
    }
    const allFindings = [...zapFindings, ...nucleiFindings].map((finding) => ({ ...finding, scan_id: scanId }));
    await insertFindings(scanId, allFindings);
    return { zap: zapFindings.length, nuclei: nucleiFindings.length };
}
async function runDastWorkflow(scanId, repoDir, detection, enabled) {
    if (!enabled) {
        console.log('[DAST] Skipped (disabled by user)');
        return { zap: null, nuclei: null };
    }
    let containerId;
    try {
        await updateScanStatus(scanId, 'booting');
        const booted = await bootApp(repoDir, detection);
        containerId = booted.containerId;
        return await runDast(scanId, booted.appUrl);
    }
    catch (error) {
        console.warn('[DAST] Boot or scan step failed, skipping DAST:', error);
        return { zap: null, nuclei: null };
    }
    finally {
        if (containerId) {
            await stopApp(containerId).catch(() => undefined);
        }
    }
}
async function runSca(scanId, repoDir) {
    await updateScanStatus(scanId, 'scanning_sca');
    const [trivyResult, npmResult] = await Promise.allSettled([
        runTrivy(repoDir, scanId),
        runNpmAudit(repoDir, scanId),
    ]);
    const trivyFindings = trivyResult.status === 'fulfilled' ? trivyResult.value : [];
    const npmFindings = npmResult.status === 'fulfilled' ? npmResult.value : [];
    if (trivyResult.status === 'rejected') {
        console.error('Trivy scan failed:', trivyResult.reason);
    }
    if (npmResult.status === 'rejected') {
        console.error('npm audit failed:', npmResult.reason);
    }
    const allFindings = [...trivyFindings, ...npmFindings];
    await insertFindings(scanId, allFindings);
    return { trivy: trivyFindings.length, npmAudit: npmFindings.length };
}
async function runScaWorkflow(scanId, repoDir, enabled) {
    if (!enabled) {
        console.log('[SCA] Skipped (disabled by user)');
        return { trivy: null, npmAudit: null };
    }
    return runSca(scanId, repoDir);
}
async function runAiAnalysis(scanId, repoDir) {
    await updateScanStatus(scanId, 'analyzing');
    const { data: findings, error: fetchError } = await insforge.database
        .from('findings')
        .select('*')
        .eq('scan_id', scanId);
    if (fetchError) {
        console.error('Failed to fetch findings for AI analysis:', fetchError);
        return;
    }
    if (!findings || findings.length === 0) {
        console.log('No findings to analyze');
        return;
    }
    const triaged = await triageFindings(findings);
    console.log(`Generating plain-language explanations for ${triaged.length} findings...`);
    const explained = await generateExplanations(triaged);
    await updateFindingDescriptions(scanId, explained);
    await updateScanStatus(scanId, 'fixing');
    const fixes = await generateFixes(explained, repoDir, scanId);
    await insertFixes(scanId, fixes);
}
async function finalizeReport(scanId) {
    await computeSummary(scanId);
    await updateScanStatus(scanId, 'complete');
}
function logScannerSummary(results) {
    const totalCount = (results.semgrep ?? 0) +
        (results.zap ?? 0) +
        (results.nuclei ?? 0) +
        (results.trivy ?? 0) +
        (results.npmAudit ?? 0);
    const skipped = [];
    if (results.semgrep === null)
        skipped.push('Semgrep');
    if (results.zap === null)
        skipped.push('ZAP');
    if (results.nuclei === null)
        skipped.push('Nuclei');
    if (results.trivy === null)
        skipped.push('Trivy');
    if (results.npmAudit === null)
        skipped.push('npm audit');
    console.log('=== Scan Pipeline Summary ===');
    console.log(`  SAST  - Semgrep:   ${results.semgrep ?? 'skipped'} findings`);
    console.log(`  DAST  - ZAP:       ${results.zap ?? 'skipped'} findings`);
    console.log(`  DAST  - Nuclei:    ${results.nuclei ?? 'skipped'} findings`);
    console.log(`  SCA   - Trivy:     ${results.trivy ?? 'skipped'} findings`);
    console.log(`  SCA   - npm audit: ${results.npmAudit ?? 'skipped'} findings`);
    console.log(`  Total: ${totalCount} findings`);
    if (skipped.length)
        console.log(`  Skipped: ${skipped.join(', ')}`);
}
