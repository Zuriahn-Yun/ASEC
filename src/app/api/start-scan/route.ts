import { NextRequest, NextResponse } from 'next/server';

const INSFORGE_BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization') || '';

    // Forward cookies from the browser request (InsForge uses httpOnly session cookies)
    const cookieHeader = req.headers.get('cookie') || '';

    // Forward to InsForge edge function server-to-server (no CORS)
    const res = await fetch(`${INSFORGE_BASE_URL}/functions/start-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to start scan' }, { status: 500 });
  }
}
