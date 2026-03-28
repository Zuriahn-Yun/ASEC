import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

/**
 * POST /api/scan - Start a new security scan
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate repo_url
    if (!body.repo_url) {
      return NextResponse.json({ error: 'repo_url is required' }, { status: 400 });
    }

    // Validate GitHub URL
    try {
      const parsed = new URL(body.repo_url);
      if (parsed.hostname !== 'github.com' || parsed.pathname.length <= 1) {
        return NextResponse.json({ error: 'Invalid GitHub URL format' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid GitHub URL format' }, { status: 400 });
    }

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

    // Extract repo name
    const parsed = new URL(body.repo_url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const repoName = parts.length >= 2 ? parts[1].replace('.git', '') : 'unknown-repo';

    // Insert scan job
    const { data: scanData, error: dbError } = await insforge.database
      .from('scan_jobs')
      .insert({
        user_id: userData.user.id,
        repo_url: body.repo_url,
        repo_name: repoName,
        status: 'queued',
        branch: body.branch || 'main',
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Failed to create scan job:', dbError);
      return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
    }

    // Trigger scanner pipeline (fire-and-forget)
    const scannerUrl = process.env.SCANNER_URL || 'http://localhost:4000';
    try {
      await fetch(`${scannerUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_id: scanData.id,
          repo_url: body.repo_url,
          branch: body.branch || 'main',
        }),
      });
    } catch (triggerError) {
      console.warn('Failed to trigger scanner:', triggerError);
      // Non-fatal: scan record exists, pipeline will need manual trigger
    }

    return NextResponse.json({ scan_id: scanData.id }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
