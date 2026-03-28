import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

/**
 * GET /api/scan/[id]/findings - List findings with optional filters
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
    const token = authHeader.replace('Bearer ', '');

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const severityFilter = searchParams.get('severity');
    const scanTypeFilter = searchParams.get('scan_type');

    // Create InsForge client with user's token
    const insforge = createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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

    // Build query
    let query = insforge.database
      .from('findings')
      .select('*')
      .eq('scan_id', scanId);

    // Apply filters
    if (severityFilter) {
      query = query.eq('severity', severityFilter);
    }
    if (scanTypeFilter) {
      query = query.eq('scan_type', scanTypeFilter);
    }

    // Execute query
    const { data: findings, error: findingsError } = await query;

    if (findingsError) {
      console.error('Failed to fetch findings:', findingsError);
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 });
    }

    // Check for available fixes
    const findingsWithFixStatus = await Promise.all(
      (findings || []).map(async (finding) => {
        const { data: fixes } = await insforge.database
          .from('fixes')
          .select('id')
          .eq('finding_id', finding.id)
          .limit(1);

        return {
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          file_path: finding.file_path,
          line_start: finding.line_start,
          line_end: finding.line_end,
          scanner: finding.scanner,
          scan_type: finding.scan_type,
          cwe_id: finding.cwe_id,
          rule_id: finding.rule_id,
          fix_available: fixes && fixes.length > 0,
        };
      })
    );

    return NextResponse.json({
      findings: findingsWithFixStatus,
      total: findingsWithFixStatus.length,
      filters: {
        severity: severityFilter,
        scan_type: scanTypeFilter,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
