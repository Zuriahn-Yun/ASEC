import { cloneRepo } from './clone.js';
import { detectFramework } from './detect.js';
import { bootApp, stopApp } from './boot.js';
import { cleanup } from './cleanup.js';

export interface PipelineJob {
  id: string;
  repo_url: string;
  branch?: string;
}

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
    repoDir = await cloneRepo(job.repo_url, job.branch);

    // 2. Detect framework
    const detection = await detectFramework(repoDir);

    // 3. SAST (runs on source — no container needed)
    await runSast(job.id, repoDir);

    // 4. Boot app for DAST (best-effort — failure is non-fatal)
    let dastEnabled = false;
    try {
      const booted = await bootApp(repoDir, detection);
      containerId = booted.containerId;
      dastEnabled = true;

      // 5. DAST
      await runDast(job.id, booted.appUrl);
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
    await runSca(job.id, repoDir);

    // 7. AI analysis + fix generation
    await runAiAnalysis(job.id);

    // 8. Report / finalize
    await finalizeReport(job.id);
  } finally {
    // Always clean up temp dir; container already stopped above
    if (repoDir) {
      await cleanup(repoDir).catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------
// Stub hooks — each will be replaced by real implementations in future issues
// ---------------------------------------------------------------------------

async function runSast(_scanId: string, _repoDir: string): Promise<void> {
  // Implemented in: packages/scanner/src/scanners/sast.ts (issue #3 / #12)
}

async function runDast(_scanId: string, _appUrl: string): Promise<void> {
  // Implemented in: packages/scanner/src/scanners/dast.ts (issue #5 / #14)
}

async function runSca(_scanId: string, _repoDir: string): Promise<void> {
  // Implemented in: packages/scanner/src/scanners/sca.ts (issue #4 / #13)
}

async function runAiAnalysis(_scanId: string): Promise<void> {
  // Implemented in: packages/scanner/src/scanners/ai.ts (issue #6 / #15)
}

async function finalizeReport(_scanId: string): Promise<void> {
  // Implemented in: packages/scanner/src/report.ts
}
