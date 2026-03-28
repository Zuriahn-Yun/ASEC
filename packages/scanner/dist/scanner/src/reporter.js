import { createClient } from '@insforge/sdk';
const insforge = createClient({
    baseUrl: process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '',
    anonKey: process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '',
});
let realtimeDisabled = false;
export async function updateScanStatus(scanId, status, error) {
    const updateData = { status };
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
        console.error('Failed to update scan status:', dbError);
        throw new Error(`Failed to update scan status: ${dbError.message}`);
    }
    await publishRealtime(scanId, 'status_changed', {
        scan_id: scanId,
        status,
        error,
        timestamp: new Date().toISOString(),
    });
}
export async function updateScanMetadata(scanId, metadata) {
    const updateData = {};
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
        console.warn('Failed to update scan metadata:', error);
    }
}
export async function insertFindings(scanId, findings) {
    if (findings.length === 0) {
        console.log('No findings to insert');
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
        console.error('Failed to insert findings:', dbError);
        throw new Error(`Failed to insert findings: ${dbError.message}`);
    }
    console.log(`Inserted ${findings.length} findings`);
    await publishRealtime(scanId, 'finding_batch', {
        scan_id: scanId,
        count: findings.length,
        timestamp: new Date().toISOString(),
    });
}
export async function updateFindingDescriptions(scanId, findings) {
    if (findings.length === 0) {
        return;
    }
    for (const finding of findings) {
        if (!finding.id || !finding.description)
            continue;
        const { error: dbError } = await insforge.database
            .from('findings')
            .update({ description: finding.description })
            .eq('id', finding.id)
            .eq('scan_id', scanId);
        if (dbError) {
            console.warn(`Failed to update description for finding ${finding.id}:`, dbError);
        }
    }
    console.log(`Updated descriptions for ${findings.length} findings`);
}
export async function insertFixes(scanId, fixes) {
    if (fixes.length === 0) {
        console.log('No fixes to insert');
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
        console.error('Failed to insert fixes:', dbError);
        throw new Error(`Failed to insert fixes: ${dbError.message}`);
    }
    console.log(`Inserted ${fixes.length} fixes`);
    for (const fix of fixes) {
        await publishRealtime(scanId, 'fix_generated', {
            scan_id: scanId,
            finding_id: fix.finding_id,
            confidence: fix.confidence,
            timestamp: new Date().toISOString(),
        });
    }
}
export async function computeSummary(scanId) {
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
            severityCounts[finding.severity]++;
        }
        if (finding.scan_type in typeCounts) {
            typeCounts[finding.scan_type]++;
        }
    }
    const { data: fixes, error: fixError } = await insforge.database
        .from('fixes')
        .select('id')
        .eq('scan_id', scanId);
    if (fixError) {
        console.error('Failed to fetch fixes for summary:', fixError);
        throw new Error(`Failed to fetch fixes: ${fixError.message}`);
    }
    const summary = {
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
        console.error('Failed to upsert scan summary:', upsertError);
        throw new Error(`Failed to upsert scan summary: ${upsertError.message}`);
    }
    console.log('Scan summary computed and saved:', summary);
}
async function publishRealtime(scanId, event, payload) {
    if (realtimeDisabled) {
        return;
    }
    try {
        await insforge.realtime.connect();
        await insforge.realtime.subscribe(`scan:${scanId}`);
        await insforge.realtime.publish(`scan:${scanId}`, event, payload);
    }
    catch (realtimeError) {
        if (realtimeError instanceof Error && realtimeError.message.includes('Invalid token')) {
            realtimeDisabled = true;
            console.warn('Realtime disabled for this scanner process because the backend rejected the token.');
            return;
        }
        console.warn('Realtime broadcast failed (non-critical):', realtimeError);
    }
}
