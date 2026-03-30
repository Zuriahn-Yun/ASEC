import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { DEMO_USER_ID, getScannerUrl } from '@/lib/insforge';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repo_url, branch = 'main', scan_types } = body;

    if (!repo_url) {
      return NextResponse.json({ error: 'repo_url is required' }, { status: 400 });
    }

    // Validate that repo_url is a well-formed URL (accepts GitHub repos AND live targets)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(repo_url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use http or https');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL — must be a valid http/https URL' }, { status: 400 });
    }

    const client = createClient({
      baseUrl: INSFORGE_BASE_URL,
      anonKey: INSFORGE_ANON_KEY,
    });

    // For GitHub repos, use the repo name. For live targets, use the hostname.
    const isGitHub = parsedUrl.hostname === 'github.com';
    const repoName = isGitHub
      ? parsedUrl.pathname.split('/').filter(Boolean)[1]?.replace('.git', '') || 'unknown'
      : parsedUrl.hostname;

    const { data: scanData, error: dbError } = await client.database
      .from('scan_jobs')
      .insert([{
        user_id: DEMO_USER_ID,
        repo_url,
        repo_name: repoName,
        status: 'queued',
        branch,
      }])
      .select('id')
      .single();

    if (dbError || !scanData?.id) {
      console.error('Failed to create scan job:', dbError);
      return NextResponse.json({ error: 'Failed to create scan job' }, { status: 500 });
    }

    const scannerUrl = getScannerUrl();

    try {
      const scannerRes = await fetch(`${scannerUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_id: scanData.id, repo_url, branch, scan_types }),
      });

      if (!scannerRes.ok) {
        const message = `Scanner trigger failed with status ${scannerRes.status}`;
        await client.database
          .from('scan_jobs')
          .update({ status: 'failed', error_message: message })
          .eq('id', scanData.id);

        return NextResponse.json(
          { error: 'Scanner service is not ready. Start the scanner server and try again.' },
          { status: 503 },
        );
      }
    } catch (error) {
      console.error('Failed to reach scanner:', error);
      await client.database
        .from('scan_jobs')
        .update({ status: 'failed', error_message: 'Scanner service is offline' })
        .eq('id', scanData.id);

      return NextResponse.json(
        { error: 'Scanner service is offline. Start the scanner server and try again.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ scan_id: scanData.id });
  } catch (error) {
    console.error('Unexpected error in start-scan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
