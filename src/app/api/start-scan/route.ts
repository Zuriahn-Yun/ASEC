import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repo_url, branch = 'main' } = body;

    // Validate repo_url
    if (!repo_url) {
      return NextResponse.json({ error: 'repo_url is required' }, { status: 400 });
    }
    try {
      const parsed = new URL(repo_url);
      if (parsed.hostname !== 'github.com' || parsed.pathname.length <= 1) throw new Error();
    } catch {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    // Create InsForge client — forward cookies for user auth (RLS)
    const cookieHeader = req.headers.get('cookie') || '';
    const insforge = createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
      headers: { Cookie: cookieHeader },
    });

    // Get authenticated user
    const { data: userData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract repo name from URL
    const repoName = new URL(repo_url).pathname.split('/').filter(Boolean)[1]?.replace('.git', '') || 'unknown';

    // Insert scan job directly via SDK (bypasses dead edge function)
    const { data: scanData, error: dbError } = await insforge.database
      .from('scan_jobs')
      .insert([{
        user_id: userData.user.id,
        repo_url,
        repo_name: repoName,
        status: 'queued',
      }])
      .select('id')
      .single();

    if (dbError) {
      console.error('Failed to create scan job:', dbError);
      return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
    }

    // Fire-and-forget: trigger scanner pipeline
    const scannerUrl = process.env.NEXT_PUBLIC_SCANNER_URL || 'http://localhost:4000';
    fetch(`${scannerUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan_id: scanData.id, repo_url, branch }),
    }).catch(() => {});

    return NextResponse.json({ scan_id: scanData.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
