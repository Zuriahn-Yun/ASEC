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
const SAST_TIMEOUT_MS = 10 * 60 * 1000;
const DAST_TIMEOUT_MS = 15 * 60 * 1000;
const SCA_TIMEOUT_MS = 5 * 60 * 1000;
export async function runPipeline(job) {
    const pipelineStart = Date.now();
    let repoDir;
    const types = {
        sast: job.scan_types?.sast !== false,
        dast: job.scan_types?.dast !== false,
        sca: job.scan_types?.sca !== false,
    };
    console.log(`\n========== PIPELINE START ==========`);
    console.log(`  Scan ID:  ${job.id}`);
    console.log(`  Repo:     ${job.repo_url}`);
    console.log(`  Branch:   ${job.branch || 'default'}`);
    console.log(`  Types:    SAST=${types.sast} DAST=${types.dast} SCA=${types.sca}`);
    console.log(`====================================\n`);
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
        console.log(`[CLONE] Done -> ${repoDir}`);
        await updateScanStatus(job.id, 'detecting');
        const detection = await detectFramework(repoDir);
        console.log(`[DETECT] Framework: ${detection.framework} | Runtime: ${detection.runtime} | Start: "${detection.startCommand}" | Port: ${detection.port}`);
        await updateScanMetadata(job.id, { framework: detection.framework });
        console.log('\n[PIPELINE] Starting parallel scan workflows...');
        const scanStart = Date.now();
        const [sastCount, dastResults, scaResults] = await Promise.all([
            withTimeout(runSastWorkflow(job.id, repoDir, types.sast), SAST_TIMEOUT_MS, '[SAST] Timed out; continuing without blocking the pipeline.', null),
            withTimeout(runDastWorkflow(job.id, repoDir, detection, types.dast), DAST_TIMEOUT_MS, '[DAST] Timed out; continuing without blocking the pipeline.', { zap: null, nuclei: null }),
            withTimeout(runScaWorkflow(job.id, repoDir, types.sca), SCA_TIMEOUT_MS, '[SCA] Timed out; continuing without blocking the pipeline.', { trivy: null, npmAudit: null }),
        ]);
        console.log(`[PIPELINE] All scan workflows finished in ${((Date.now() - scanStart) / 1000).toFixed(1)}s`);
        scannerResults.semgrep = sastCount;
        scannerResults.zap = dastResults.zap;
        scannerResults.nuclei = dastResults.nuclei;
        scannerResults.trivy = scaResults.trivy;
        scannerResults.npmAudit = scaResults.npmAudit;
        logScannerSummary(scannerResults);
        // AI analysis — non-fatal
        try {
            await runAiAnalysis(job.id, repoDir);
        }
        catch (aiError) {
            console.error('[AI] Analysis failed (non-fatal):', aiError);
        }
        // Finalize — non-fatal summary, but always try to set status=complete
        try {
            await finalizeReport(job.id);
        }
        catch (finalError) {
            console.error('[FINALIZE] Report failed, forcing complete status:', finalError);
            await updateScanStatus(job.id, 'complete');
        }
        console.log(`\n========== PIPELINE COMPLETE (${((Date.now() - pipelineStart) / 1000).toFixed(1)}s) ==========\n`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[PIPELINE] Fatal error: ${errorMessage}`);
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
    try {
        return await runSast(scanId, repoDir);
    }
    catch (error) {
        console.warn('[SAST] Scan failed, skipping:', error);
        return null;
    }
}
async function runDast(scanId, appUrl) {
    await updateScanStatus(scanId, 'scanning_dast');
    // Run Nuclei and ZAP in parallel — both against the booted app
    const [nucleiResult, zapResult] = await Promise.allSettled([
        runNuclei(appUrl),
        runZap(appUrl),
    ]);
    const nucleiFindings = nucleiResult.status === 'fulfilled' ? nucleiResult.value : [];
    const zapFindings = zapResult.status === 'fulfilled' ? zapResult.value : [];
    if (nucleiResult.status === 'rejected') {
        console.error('[DAST] Nuclei scan failed:', nucleiResult.reason);
    }
    if (zapResult.status === 'rejected') {
        console.error('[DAST] ZAP scan failed:', zapResult.reason);
    }
    const allFindings = [...nucleiFindings, ...zapFindings].map((f) => ({ ...f, scan_id: scanId }));
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
        console.error('[SCA] Trivy scan failed:', trivyResult.reason);
    }
    if (npmResult.status === 'rejected') {
        console.error('[SCA] npm audit failed:', npmResult.reason);
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
    try {
        return await runSca(scanId, repoDir);
    }
    catch (error) {
        console.warn('[SCA] Scan failed, skipping:', error);
        return { trivy: null, npmAudit: null };
    }
}
async function runAiAnalysis(scanId, repoDir) {
    await updateScanStatus(scanId, 'analyzing');
    const { data: findings, error: fetchError } = await insforge.database
        .from('findings')
        .select('*')
        .eq('scan_id', scanId);
    if (fetchError) {
        console.error('[AI] Failed to fetch findings for analysis:', fetchError);
        return;
    }
    if (!findings || findings.length === 0) {
        console.log('[AI] No findings to analyze');
        return;
    }
    console.log(`[AI] Triaging ${findings.length} findings...`);
    const triaged = await triageFindings(findings);
    console.log(`[AI] Generating plain-language explanations for ${triaged.length} findings...`);
    const explained = await generateExplanations(triaged);
    await updateFindingDescriptions(scanId, explained);
    await updateScanStatus(scanId, 'fixing');
    console.log('[AI] Generating fixes...');
    const fixes = await generateFixes(explained, repoDir, scanId);
    await insertFixes(scanId, fixes);
    console.log(`[AI] Generated ${fixes.length} fixes`);
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
    console.log('\n=== Scan Pipeline Summary ===');
    console.log(`  SAST  - Semgrep:   ${results.semgrep ?? 'skipped'} findings`);
    console.log(`  DAST  - ZAP:       ${results.zap ?? 'skipped'} findings`);
    console.log(`  DAST  - Nuclei:    ${results.nuclei ?? 'skipped'} findings`);
    console.log(`  SCA   - Trivy:     ${results.trivy ?? 'skipped'} findings`);
    console.log(`  SCA   - npm audit: ${results.npmAudit ?? 'skipped'} findings`);
    console.log(`  Total: ${totalCount} findings`);
    if (skipped.length)
        console.log(`  Skipped: ${skipped.join(', ')}`);
}
async function withTimeout(task, timeoutMs, timeoutMessage, fallback) {
    let timer;
    try {
        return await Promise.race([
            task,
            new Promise((resolve) => {
                timer = setTimeout(() => {
                    console.warn(timeoutMessage);
                    resolve(fallback);
                }, timeoutMs);
            }),
        ]);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}
