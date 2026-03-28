import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

/**
 * GET /api/scan/[id]/summary - Get severity breakdown counts
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

    // Verify scan belongs to user
    const { data: scan, error: scanError } = await insforge.database
      .from('scan_jobs')
      .select('id')
      .eq('id', scanId)
      .eq('user_id', userData.user.id)
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Fetch summary from scan_summaries table
    const { data: summary, error: summaryError } = await insforge.database
      .from('scan_summaries')
      .select('*')
      .eq('scan_id', scanId)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Failed to fetch summary:', summaryError);
      return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }

    // If no summary exists, calculate from findings
    if (!summary) {
      const { data: findings, error: findingsError } = await insforge.database
        .from('findings')
        .select('severity, scan_type')
        .eq('scan_id', scanId);

      if (findingsError) {
        console.error('Failed to fetch findings:', findingsError);
        return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 });
      }

      const calculated = {
        total_findings: findings?.length || 0,
        critical_count: findings?.filter(f => f.severity === 'critical').length || 0,
        high_count: findings?.filter(f => f.severity === 'high').length || 0,
        medium_count: findings?.filter(f => f.severity === 'medium').length || 0,
        low_count: findings?.filter(f => f.severity === 'low').length || 0,
        info_count: findings?.filter(f => f.severity === 'info').length || 0,
        sast_count: findings?.filter(f => f.scan_type === 'sast').length || 0,
        dast_count: findings?.filter(f => f.scan_type === 'dast').length || 0,
        sca_count: findings?.filter(f => f.scan_type === 'sca').length || 0,
      };

      return NextResponse.json(calculated, { status: 200 });
    }

    return NextResponse.json({
      total_findings: summary.total_findings,
      critical_count: summary.critical_count,
      high_count: summary.high_count,
      medium_count: summary.medium_count,
      low_count: summary.low_count,
      info_count: summary.info_count,
      sast_count: summary.sast_count,
      dast_count: summary.dast_count,
      sca_count: summary.sca_count,
      fixes_generated: summary.fixes_generated,
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
