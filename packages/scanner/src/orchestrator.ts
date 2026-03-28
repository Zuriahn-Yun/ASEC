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
import type { ScanFinding } from '../../shared/types/finding.js';
import { updateScanStatus, insertFindings, insertFixes, computeSummary, updateFindingDescriptions } from './reporter.js';
import { createClient } from '@insforge/sdk';

export interface PipelineJob {
  id: string;
  repo_url: string;
  branch?: string;
}

// Initialize InsForge client for AI analysis
const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
  anonKey: process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '',
});

/**
 * Runs the full scan pipeline for a given job.
 *
 * Sequence: clone → detect → SAST → boot → DAST → teardown → SCA → AI → report → cleanup
 * If booting the app fails, the pipeline continues with SAST + SCA only (no DAST).
 */
export async function runPipeline(job: PipelineJob): Promise<void> {
  let repoDir: string | undefined;
  let containerId: string | undefined;

  try {
    // 1. Clone
    await updateScanStatus(job.id, 'cloning');
    repoDir = await cloneRepo(job.repo_url, job.branch);

    // 2. Detect framework
    await updateScanStatus(job.id, 'detecting');
    const detection = await detectFramework(repoDir);

    // Track scanner results for summary
    const scannerResults: {
      semgrep: number | null;
      zap: number | null;
      nuclei: number | null;
      trivy: number | null;
      npmAudit: number | null;
    } = {
      semgrep: null,
      zap: null,
      nuclei: null,
      trivy: null,
      npmAudit: null,
    };

    // 3. SAST (runs on source — no container needed)
    scannerResults.semgrep = await runSast(job.id, repoDir);

    // 4. Boot app for DAST (best-effort — failure is non-fatal)
    let dastEnabled = false;
    let appUrl: string | undefined;
    try {
      await updateScanStatus(job.id, 'booting');
      const booted = await bootApp(repoDir, detection);
      containerId = booted.containerId;
      appUrl = booted.appUrl;
      dastEnabled = true;

      // 5. DAST
      const dastResults = await runDast(job.id, appUrl);
      scannerResults.zap = dastResults.zap;
      scannerResults.nuclei = dastResults.nuclei;
    } catch {
      // Boot failed — skip DAST, continue with SCA + AI
    } finally {
      if (containerId) {
        await stopApp(containerId).catch(() => undefined);
        containerId = undefined;
      }
    }

    void dastEnabled; // acknowledged: dastEnabled used implicitly via runDast call above

    // 6. SCA
    const scaResults = await runSca(job.id, repoDir);
    scannerResults.trivy = scaResults.trivy;
    scannerResults.npmAudit = scaResults.npmAudit;

    // 7. AI analysis + fix generation
    await runAiAnalysis(job.id, repoDir);

    // 8. Log summary
    logScannerSummary(scannerResults);

    // 9. Report / finalize
    await finalizeReport(job.id);
  } catch (error) {
    // Update scan status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateScanStatus(job.id, 'failed', errorMessage);
    throw error;
  } finally {
    // Always clean up temp dir; container already stopped above
    if (repoDir) {
      await cleanup(repoDir).catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------
// Real implementations — wired to scanner wrappers, AI analyzer, and reporter
// ---------------------------------------------------------------------------

async function runSast(scanId: string, repoDir: string): Promise<number> {
  await updateScanStatus(scanId, 'scanning_sast');
  
  const findings = await runSemgrep(repoDir);
  
  // Set scan_id on each finding
  const findingsWithScanId = findings.map(f => ({ ...f, scan_id: scanId }));
  
  await insertFindings(scanId, findingsWithScanId);
  
  return findings.length;
}

async function runDast(scanId: string, appUrl: string): Promise<{ zap: number; nuclei: number }> {
  await updateScanStatus(scanId, 'scanning_dast');
  
  // Run ZAP and Nuclei in parallel
  const [zapResult, nucleiResult] = await Promise.allSettled([
    runZap(appUrl),
    runNuclei(appUrl),
  ]);
  
  const zapFindings = zapResult.status === 'fulfilled' ? zapResult.value : [];
  const nucleiFindings = nucleiResult.status === 'fulfilled' ? nucleiResult.value : [];
  
  // Log errors if any
  if (zapResult.status === 'rejected') {
    console.error('ZAP scan failed:', zapResult.reason);
  }
  if (nucleiResult.status === 'rejected') {
    console.error('Nuclei scan failed:', nucleiResult.reason);
  }
  
  // Combine findings and set scan_id
  const allFindings = [...zapFindings, ...nucleiFindings].map(f => ({ ...f, scan_id: scanId }));
  
  await insertFindings(scanId, allFindings);
  
  return { zap: zapFindings.length, nuclei: nucleiFindings.length };
}

async function runSca(scanId: string, repoDir: string): Promise<{ trivy: number; npmAudit: number }> {
  await updateScanStatus(scanId, 'scanning_sca');
  
  // Run Trivy and npm audit in parallel
  const [trivyResult, npmResult] = await Promise.allSettled([
    runTrivy(repoDir, scanId),
    runNpmAudit(repoDir, scanId),
  ]);
  
  const trivyFindings = trivyResult.status === 'fulfilled' ? trivyResult.value : [];
  const npmFindings = npmResult.status === 'fulfilled' ? npmResult.value : [];
  
  // Log errors if any
  if (trivyResult.status === 'rejected') {
    console.error('Trivy scan failed:', trivyResult.reason);
  }
  if (npmResult.status === 'rejected') {
    console.error('npm audit failed:', npmResult.reason);
  }
  
  // Combine findings
  const allFindings = [...trivyFindings, ...npmFindings];
  
  await insertFindings(scanId, allFindings);
  
  return { trivy: trivyFindings.length, npmAudit: npmFindings.length };
}

async function runAiAnalysis(scanId: string, repoDir: string): Promise<void> {
  await updateScanStatus(scanId, 'analyzing');
  
  // Fetch findings from DB
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
  
  // Triage findings (DB findings have real IDs — cast to ScanFinding[])
  const triaged = await triageFindings(findings as ScanFinding[]);
  
  // Generate plain-language explanations for all findings
  console.log(`Generating plain-language explanations for ${triaged.length} findings...`);
  const explained = await generateExplanations(triaged);
  
  // Update findings in DB with plain explanations
  await updateFindingDescriptions(scanId, explained);
  
  await updateScanStatus(scanId, 'fixing');
  
  // Generate fixes
  const fixes = await generateFixes(explained, repoDir, scanId);
  
  await insertFixes(scanId, fixes);
}

async function finalizeReport(scanId: string): Promise<void> {
  await computeSummary(scanId);
  await updateScanStatus(scanId, 'complete');
}

interface ScannerResults {
  semgrep: number | null;
  zap: number | null;
  nuclei: number | null;
  trivy: number | null;
  npmAudit: number | null;
}

function logScannerSummary(results: ScannerResults): void {
  const totalCount = 
    (results.semgrep ?? 0) + 
    (results.zap ?? 0) + 
    (results.nuclei ?? 0) + 
    (results.trivy ?? 0) + 
    (results.npmAudit ?? 0);
  
  const skipped: string[] = [];
  if (results.semgrep === null) skipped.push('Semgrep');
  if (results.zap === null) skipped.push('ZAP');
  if (results.nuclei === null) skipped.push('Nuclei');
  if (results.trivy === null) skipped.push('Trivy');
  if (results.npmAudit === null) skipped.push('npm audit');
  
  console.log('=== Scan Pipeline Summary ===');
  console.log(`  SAST  - Semgrep:   ${results.semgrep ?? 'skipped'} findings`);
  console.log(`  DAST  - ZAP:       ${results.zap ?? 'skipped'} findings`);
  console.log(`  DAST  - Nuclei:    ${results.nuclei ?? 'skipped'} findings`);
  console.log(`  SCA   - Trivy:     ${results.trivy ?? 'skipped'} findings`);
  console.log(`  SCA   - npm audit: ${results.npmAudit ?? 'skipped'} findings`);
  console.log(`  Total: ${totalCount} findings`);
  if (skipped.length) console.log(`  Skipped: ${skipped.join(', ')}`);
}
