import { createClient } from '@insforge/sdk';
import type { ScanFinding } from '../../shared/types/finding.js';
import type { Fix, ScanSummary } from '../../shared/types/fix.js';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
  anonKey: process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '',
});

let realtimeDisabled = false;

export async function updateScanStatus(
  scanId: string,
  status: string,
  error?: string,
): Promise<void> {
  const updateData: Record<string, string> = { status };

  if (status === 'cloning') {
    updateData.started_at = new Date().toISOString();
  }

  if (status === 'complete' || status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  if (error) {
    updateData.error_message = error;
  }

  const { error: dbError } = await insforge.database
    .from('scan_jobs')
    .update(updateData)
    .eq('id', scanId);

  if (dbError) {
    // Log but do NOT throw — status updates are progress indicators, not critical
    console.error(`[REPORTER] Failed to update status to "${status}":`, dbError);
    return;
  }

  await publishRealtime(scanId, 'status_changed', {
    scan_id: scanId,
    status,
    error,
    timestamp: new Date().toISOString(),
  });
}

export async function updateScanMetadata(
  scanId: string,
  metadata: { framework?: string },
): Promise<void> {
  const updateData: Record<string, string> = {};

  if (metadata.framework) {
    updateData.framework = metadata.framework;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  const { error } = await insforge.database
    .from('scan_jobs')
    .update(updateData)
    .eq('id', scanId);

  if (error) {
    console.warn('[REPORTER] Failed to update scan metadata:', error);
  }
}

export async function insertFindings(
  scanId: string,
  findings: Omit<ScanFinding, 'id' | 'created_at'>[],
): Promise<void> {
  if (findings.length === 0) {
    console.log('[REPORTER] No findings to insert');
    return;
  }

  const findingsWithScanId = findings.map((finding) => ({
    ...finding,
    scan_id: scanId,
  }));

  const { error: dbError } = await insforge.database
    .from('findings')
    .insert(findingsWithScanId);

  if (dbError) {
    console.error('[REPORTER] Failed to insert findings:', dbError);
    throw new Error(`Failed to insert findings: ${dbError.message}`);
  }

  console.log(`[REPORTER] Inserted ${findings.length} findings`);

  await publishRealtime(scanId, 'finding_batch', {
    scan_id: scanId,
    count: findings.length,
    timestamp: new Date().toISOString(),
  });
}

export async function updateFindingDescriptions(
  scanId: string,
  findings: ScanFinding[],
): Promise<void> {
  if (findings.length === 0) {
    return;
  }

  for (const finding of findings) {
    if (!finding.id || !finding.description) continue;

    const { error: dbError } = await insforge.database
      .from('findings')
      .update({ description: finding.description })
      .eq('id', finding.id)
      .eq('scan_id', scanId);

    if (dbError) {
      console.warn(`[REPORTER] Failed to update description for finding ${finding.id}:`, dbError);
    }
  }

  console.log(`[REPORTER] Updated descriptions for ${findings.length} findings`);
}

export async function insertFixes(
  scanId: string,
  fixes: Omit<Fix, 'id' | 'created_at'>[],
): Promise<void> {
  if (fixes.length === 0) {
    console.log('[REPORTER] No fixes to insert');
    return;
  }

  const fixesWithScanId = fixes.map((fix) => ({
    ...fix,
    scan_id: scanId,
  }));

  const { error: dbError } = await insforge.database
    .from('fixes')
    .insert(fixesWithScanId);

  if (dbError) {
    console.error('[REPORTER] Failed to insert fixes:', dbError);
    throw new Error(`Failed to insert fixes: ${dbError.message}`);
  }

  console.log(`[REPORTER] Inserted ${fixes.length} fixes`);

  for (const fix of fixes) {
    await publishRealtime(scanId, 'fix_generated', {
      scan_id: scanId,
      finding_id: fix.finding_id,
      confidence: fix.confidence,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function computeSummary(scanId: string): Promise<void> {
  const { data: findings, error: fetchError } = await insforge.database
    .from('findings')
    .select('severity, scan_type')
    .eq('scan_id', scanId);

  if (fetchError) {
    console.error('[REPORTER] Failed to fetch findings for summary:', fetchError);
    return; // Non-fatal: don't crash finalization
  }

  if (!findings) {
    console.log('[REPORTER] No findings found for summary');
    return;
  }

  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const typeCounts = {
    sast: 0,
    dast: 0,
    sca: 0,
  };

  for (const finding of findings) {
    if (finding.severity in severityCounts) {
      severityCounts[finding.severity as keyof typeof severityCounts]++;
    }
    if (finding.scan_type in typeCounts) {
      typeCounts[finding.scan_type as keyof typeof typeCounts]++;
    }
  }

  const { data: fixes, error: fixError } = await insforge.database
    .from('fixes')
    .select('id')
    .eq('scan_id', scanId);

  if (fixError) {
    console.error('[REPORTER] Failed to fetch fixes for summary:', fixError);
    // Continue with fixes_generated = 0 instead of crashing
  }

  const summary: Omit<ScanSummary, 'scan_id'> = {
    total_findings: findings.length,
    critical_count: severityCounts.critical,
    high_count: severityCounts.high,
    medium_count: severityCounts.medium,
    low_count: severityCounts.low,
    info_count: severityCounts.info,
    sast_count: typeCounts.sast,
    dast_count: typeCounts.dast,
    sca_count: typeCounts.sca,
    fixes_generated: fixes?.length || 0,
  };

  const { error: upsertError } = await insforge.database
    .from('scan_summaries')
    .upsert({
      scan_id: scanId,
      ...summary,
    });

  if (upsertError) {
    console.error('[REPORTER] Failed to upsert scan summary:', upsertError);
    return; // Non-fatal
  }

  console.log('[REPORTER] Scan summary saved:', summary);
}

// Maximum time we'll spend on a realtime operation before giving up.
// The SDK's subscribe() wraps a socket.io ack with no built-in timeout; without
// this guard a missed server ack would stall the pipeline indefinitely.
const REALTIME_OP_TIMEOUT_MS = 8_000;

async function publishRealtime(scanId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (realtimeDisabled) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutGuard = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Realtime operation timed out after ${REALTIME_OP_TIMEOUT_MS}ms`)),
      REALTIME_OP_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([
      (async () => {
        await insforge.realtime.connect();
        await insforge.realtime.subscribe(`scan:${scanId}`);
        await insforge.realtime.publish(`scan:${scanId}`, event, payload);
      })(),
      timeoutGuard,
    ]);
  } catch (realtimeError) {
    if (realtimeError instanceof Error && realtimeError.message.includes('Invalid token')) {
      realtimeDisabled = true;
      console.warn('[REPORTER] Realtime disabled for this scanner process because the backend rejected the token.');
      return;
    }

    console.warn('[REPORTER] Realtime broadcast failed (non-critical):', realtimeError);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
