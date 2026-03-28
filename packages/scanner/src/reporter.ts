import { createClient } from '@insforge/sdk';

// Type definitions (mirrored from shared/types)
type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type ScannerType = 'semgrep' | 'zap' | 'nuclei' | 'trivy' | 'npm_audit';
type ScanCategory = 'sast' | 'dast' | 'sca';

interface ScanFinding {
  id: string;
  scan_id: string;
  scanner: ScannerType;
  scan_type: ScanCategory;
  severity: SeverityLevel;
  title: string;
  description?: string;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  cwe_id?: string;
  rule_id?: string;
  raw_sarif?: Record<string, unknown>;
  created_at: string;
}

interface Fix {
  id: string;
  finding_id: string;
  scan_id: string;
  explanation: string;
  original_code?: string;
  fixed_code?: string;
  diff_patch?: string;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

interface ScanSummary {
  scan_id: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  sast_count: number;
  dast_count: number;
  sca_count: number;
  fixes_generated: number;
}

// Initialize InsForge client
const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
  anonKey: process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '',
});

/**
 * Update scan status and broadcast realtime event
 */
export async function updateScanStatus(
  scanId: string,
  status: string,
  error?: string
): Promise<void> {
  const updateData: Record<string, string> = { status };
  if (error) {
    updateData.error_message = error;
  }

  const { error: dbError } = await insforge.database
    .from('scan_jobs')
    .update(updateData)
    .eq('id', scanId);

  if (dbError) {
    console.error('Failed to update scan status:', dbError);
    throw new Error(`Failed to update scan status: ${dbError.message}`);
  }

  // Broadcast realtime event
  try {
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`scan:${scanId}`);
    await insforge.realtime.publish(`scan:${scanId}`, 'status_changed', {
      scan_id: scanId,
      status,
      error,
      timestamp: new Date().toISOString(),
    });
  } catch (realtimeError) {
    console.warn('Realtime broadcast failed (non-critical):', realtimeError);
  }
}

/**
 * Batch insert findings and broadcast finding_batch event
 */
export async function insertFindings(
  scanId: string,
  findings: Omit<ScanFinding, 'id' | 'created_at'>[]
): Promise<void> {
  if (findings.length === 0) {
    console.log('No findings to insert');
    return;
  }

  // Add scan_id to each finding
  const findingsWithScanId = findings.map(finding => ({
    ...finding,
    scan_id: scanId,
  }));

  const { error: dbError } = await insforge.database
    .from('findings')
    .insert(findingsWithScanId);

  if (dbError) {
    console.error('Failed to insert findings:', dbError);
    throw new Error(`Failed to insert findings: ${dbError.message}`);
  }

  console.log(`Inserted ${findings.length} findings`);

  // Broadcast realtime event
  try {
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`scan:${scanId}`);
    await insforge.realtime.publish(`scan:${scanId}`, 'finding_batch', {
      scan_id: scanId,
      count: findings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (realtimeError) {
    console.warn('Realtime broadcast failed (non-critical):', realtimeError);
  }
}

/**
 * Update finding descriptions with plain-language explanations
 */
export async function updateFindingDescriptions(
  scanId: string,
  findings: ScanFinding[]
): Promise<void> {
  if (findings.length === 0) {
    return;
  }

  // Update each finding's description in the database
  for (const finding of findings) {
    if (!finding.id || !finding.description) continue;

    const { error: dbError } = await insforge.database
      .from('findings')
      .update({ description: finding.description })
      .eq('id', finding.id)
      .eq('scan_id', scanId);

    if (dbError) {
      console.warn(`Failed to update description for finding ${finding.id}:`, dbError);
      // Continue with other findings - non-critical
    }
  }

  console.log(`Updated descriptions for ${findings.length} findings`);
}

/**
 * Batch insert fixes and broadcast fix_generated events
 */
export async function insertFixes(
  scanId: string,
  fixes: Omit<Fix, 'id' | 'created_at'>[]
): Promise<void> {
  if (fixes.length === 0) {
    console.log('No fixes to insert');
    return;
  }

  // Add scan_id to each fix
  const fixesWithScanId = fixes.map(fix => ({
    ...fix,
    scan_id: scanId,
  }));

  const { error: dbError } = await insforge.database
    .from('fixes')
    .insert(fixesWithScanId);

  if (dbError) {
    console.error('Failed to insert fixes:', dbError);
    throw new Error(`Failed to insert fixes: ${dbError.message}`);
  }

  console.log(`Inserted ${fixes.length} fixes`);

  // Broadcast realtime event for each fix
  try {
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`scan:${scanId}`);
    
    for (const fix of fixes) {
      await insforge.realtime.publish(`scan:${scanId}`, 'fix_generated', {
        scan_id: scanId,
        finding_id: fix.finding_id,
        confidence: fix.confidence,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (realtimeError) {
    console.warn('Realtime broadcast failed (non-critical):', realtimeError);
  }
}

/**
 * Compute and upsert scan summary
 */
export async function computeSummary(scanId: string): Promise<void> {
  // Fetch all findings for this scan
  const { data: findings, error: fetchError } = await insforge.database
    .from('findings')
    .select('severity, scan_type')
    .eq('scan_id', scanId);

  if (fetchError) {
    console.error('Failed to fetch findings for summary:', fetchError);
    throw new Error(`Failed to fetch findings: ${fetchError.message}`);
  }

  if (!findings) {
    console.log('No findings found for summary');
    return;
  }

  // Count by severity
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  // Count by scan type
  const typeCounts = {
    sast: 0,
    dast: 0,
    sca: 0,
  };

  for (const finding of findings) {
    // Count severity
    if (finding.severity in severityCounts) {
      severityCounts[finding.severity as keyof typeof severityCounts]++;
    }
    // Count scan type
    if (finding.scan_type in typeCounts) {
      typeCounts[finding.scan_type as keyof typeof typeCounts]++;
    }
  }

  // Fetch fix count
  const { data: fixes, error: fixError } = await insforge.database
    .from('fixes')
    .select('id')
    .eq('scan_id', scanId);

  if (fixError) {
    console.error('Failed to fetch fixes for summary:', fixError);
    throw new Error(`Failed to fetch fixes: ${fixError.message}`);
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

  // Upsert summary (insert or update)
  const { error: upsertError } = await insforge.database
    .from('scan_summaries')
    .upsert({
      scan_id: scanId,
      ...summary,
    });

  if (upsertError) {
    console.error('Failed to upsert scan summary:', upsertError);
    throw new Error(`Failed to upsert scan summary: ${upsertError.message}`);
  }

  console.log('Scan summary computed and saved:', summary);
}
