// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Validates if the URL is a valid GitHub URL
 */
function isValidGitHubUrl(url) {
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
function extractRepoName(url) {
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

/**
 * Get current user from token using REST API
 */
async function getCurrentUser(baseUrl, token) {
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    return { error: { message: 'Unauthorized' } };
  }
  
  const data = await response.json();
  return { data: { user: data } };
}

/**
 * Insert scan job using REST API
 */
async function insertScanJob(baseUrl, token, jobData) {
  const response = await fetch(`${baseUrl}/rest/v1/scan_jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(jobData),
  });
  
  if (!response.ok) {
    const error = await response.text();
    return { error: { message: error } };
  }
  
  const data = await response.json();
  return { data: data[0] };
}

export default async function(req) {
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
    let body;
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

    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const baseUrl = Deno.env.get('INSFORGE_BASE_URL') || '';

    // Get authenticated user
    const { data: userData, error: authError } = await getCurrentUser(baseUrl, userToken);
    
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
    const { data: scanData, error: dbError } = await insertScanJob(baseUrl, userToken, {
      user_id: userId,
      repo_url: body.repo_url,
      repo_name: repoName,
      status: 'queued',
    });

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

    // Trigger the scanner pipeline (fire-and-forget)
    const scannerUrl = Deno.env.get('SCANNER_URL') || 'http://localhost:4000';
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
      // Non-fatal: scan record exists, pipeline will need manual trigger
      console.warn('Failed to trigger scanner:', triggerError);
    }

    // Return scan_id
    const response = {
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
