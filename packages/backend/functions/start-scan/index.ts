import { createClient } from 'npm:@insforge/sdk';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface StartScanRequest {
  repo_url: string;
  branch?: string;
}

interface StartScanResponse {
  scan_id?: string;
  error?: string;
}

/**
 * Validates if the URL is a valid GitHub URL
 */
function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Extracts repo name from GitHub URL
 */
function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[1].replace('.git', '');
    }
    return 'unknown-repo';
  } catch {
    return 'unknown-repo';
  }
}

export default async function(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parse request body
    let body: StartScanRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate repo_url
    if (!body.repo_url) {
      return new Response(
        JSON.stringify({ error: 'repo_url is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!isValidGitHubUrl(body.repo_url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid GitHub URL format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract repo name from URL
    const repoName = extractRepoName(body.repo_url);

    // Extract auth token from request headers
    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    // Create InsForge client with service role for DB access
    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || '',
      edgeFunctionToken: userToken,
    });

    // Get authenticated user
    const { data: userData, error: authError } = await client.auth.getCurrentUser();
    
    if (authError || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = userData.user.id;

    // Insert scan job with status 'queued'
    const { data: scanData, error: dbError } = await client.database
      .from('scan_jobs')
      .insert({
        user_id: userId,
        repo_url: body.repo_url,
        repo_name: repoName,
        status: 'queued',
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Failed to create scan job:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to create scan job' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Return scan_id
    const response: StartScanResponse = {
      scan_id: scanData.id,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
