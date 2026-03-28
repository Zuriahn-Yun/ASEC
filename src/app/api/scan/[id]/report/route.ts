import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

/**
 * GET /api/scan/[id]/report - Get complete JSON report (scan + findings + fixes)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: scanId } = await params;

    // Create InsForge client
    const insforge = createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
    });

    // Verify user is authenticated
    const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch scan job
    const { data: scan, error: scanError } = await insforge.database
      .from('scan_jobs')
      .select('*')
      .eq('id', scanId)
      .eq('user_id', userData.user.id)
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Fetch findings
    const { data: findings, error: findingsError } = await insforge.database
      .from('findings')
      .select('*')
      .eq('scan_id', scanId);

    if (findingsError) {
      console.error('Failed to fetch findings:', findingsError);
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 });
    }

    // Fetch fixes
    const { data: fixes, error: fixesError } = await insforge.database
      .from('fixes')
      .select('*')
      .eq('scan_id', scanId);

    if (fixesError) {
      console.error('Failed to fetch fixes:', fixesError);
      return NextResponse.json({ error: 'Failed to fetch fixes' }, { status: 500 });
    }

    // Fetch summary
    const { data: summary } = await insforge.database
      .from('scan_summaries')
      .select('*')
      .eq('scan_id', scanId)
      .single();

    // Build complete report
    const report = {
      scan: {
        id: scan.id,
        repo_url: scan.repo_url,
        repo_name: scan.repo_name,
        branch: scan.branch,
        status: scan.status,
        framework: scan.framework,
        started_at: scan.started_at,
        completed_at: scan.completed_at,
        error_message: scan.error_message,
        created_at: scan.created_at,
      },
      summary: summary || {
        total_findings: findings?.length || 0,
        critical_count: findings?.filter(f => f.severity === 'critical').length || 0,
        high_count: findings?.filter(f => f.severity === 'high').length || 0,
        medium_count: findings?.filter(f => f.severity === 'medium').length || 0,
        low_count: findings?.filter(f => f.severity === 'low').length || 0,
        info_count: findings?.filter(f => f.severity === 'info').length || 0,
        sast_count: findings?.filter(f => f.scan_type === 'sast').length || 0,
        dast_count: findings?.filter(f => f.scan_type === 'dast').length || 0,
        sca_count: findings?.filter(f => f.scan_type === 'sca').length || 0,
        fixes_generated: fixes?.length || 0,
      },
      findings: findings || [],
      fixes: fixes || [],
      exported_at: new Date().toISOString(),
    };

    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
