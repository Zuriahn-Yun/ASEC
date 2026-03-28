import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

/**
 * GET /api/scan/[id] - Get scan status and metadata
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

    return NextResponse.json({
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
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
