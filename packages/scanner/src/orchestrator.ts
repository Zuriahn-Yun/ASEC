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
  scan_types?: { sast?: boolean; sca?: boolean; dast?: boolean };
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

  // Default all scan types to true if not specified (backward compat)
  const types = {
    sast: job.scan_types?.sast !== false,
    dast: job.scan_types?.dast !== false,
    sca: job.scan_types?.sca !== false,
  };

  try {
    // 1. Clone
    await updateScanStatus(job.id, 'cloning');
    repoDir = await cloneRepo(job.repo_url, job.branch);

    // 2. Detect framework
    await updateScanStatus(job.id, 'detecting');
    const detection = await detectFramework(repoDir);

    // 3. SAST (runs on source — no container needed)
    if (types.sast) {
      await runSast(job.id, repoDir);
    } else {
      console.log('[SAST] Skipped (disabled by user)');
      await updateScanStatus(job.id, 'scanning_sast');
    }

    // 4. Boot app for DAST (best-effort — failure is non-fatal)
    if (types.dast) {
      try {
        await updateScanStatus(job.id, 'booting');
        const booted = await bootApp(repoDir, detection);
        containerId = booted.containerId;
        const appUrl = booted.appUrl;

        // 5. DAST
        await runDast(job.id, appUrl);
      } catch {
        // Boot failed — skip DAST, continue with SCA + AI
      } finally {
        if (containerId) {
          await stopApp(containerId).catch(() => undefined);
          containerId = undefined;
        }
      }
    } else {
      console.log('[DAST] Skipped (disabled by user)');
      await updateScanStatus(job.id, 'scanning_dast');
    }

    // 6. SCA
    if (types.sca) {
      await runSca(job.id, repoDir);
    } else {
      console.log('[SCA] Skipped (disabled by user)');
      await updateScanStatus(job.id, 'scanning_sca');
    }

    // 7. AI analysis + fix generation
    await runAiAnalysis(job.id, repoDir);

    // 8. Report / finalize
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

async function runSast(scanId: string, repoDir: string): Promise<void> {
  await updateScanStatus(scanId, 'scanning_sast');
  
  const findings = await runSemgrep(repoDir);
  
  // Set scan_id on each finding
  const findingsWithScanId = findings.map(f => ({ ...f, scan_id: scanId }));
  
  await insertFindings(scanId, findingsWithScanId);
}

async function runDast(scanId: string, appUrl: string): Promise<void> {
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
}

async function runSca(scanId: string, repoDir: string): Promise<void> {
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
