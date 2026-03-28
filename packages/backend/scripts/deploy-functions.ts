#!/usr/bin/env node
/**
 * Deploy edge functions to InsForge
 * 
 * Usage:
 *   npm run deploy-functions
 * 
 * Required environment variables:
 *   INSFORGE_BASE_URL - Your InsForge backend URL
 *   INSFORGE_API_KEY  - Your InsForge admin API key
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const INSFORGE_BASE_URL = process.env.INSFORGE_BASE_URL || 'https://66wjtrxb.us-west.insforge.app';
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

if (!INSFORGE_API_KEY) {
  console.error('ERROR: INSFORGE_API_KEY environment variable is required');
  console.error('Get your API key from the InsForge dashboard');
  process.exit(1);
}

interface FunctionDeployment {
  name: string;
  slug: string;
  description: string;
  filePath: string;
}

const FUNCTIONS: FunctionDeployment[] = [
  {
    name: 'Start Scan',
    slug: 'start-scan',
    description: 'Creates a new scan job and triggers the scanner pipeline',
    filePath: join(__dirname, '../functions/start-scan/index.ts'),
  },
];

async function deployFunction(fn: FunctionDeployment): Promise<void> {
  console.log(`\n📦 Deploying function: ${fn.slug}`);
  
  const code = readFileSync(fn.filePath, 'utf-8');
  
  // Convert Deno-style import to work with InsForge
  const processedCode = code.replace(
    /import \{ createClient \} from 'npm:@insforge\/sdk';/,
    `import { createClient } from 'https://esm.sh/@insforge/sdk@latest';`
  );
  
  const response = await fetch(`${INSFORGE_BASE_URL}/rest/v1/functions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INSFORGE_API_KEY}`,
      'apikey': INSFORGE_API_KEY,
    },
    body: JSON.stringify({
      name: fn.name,
      slug: fn.slug,
      description: fn.description,
      code: processedCode,
      status: 'active',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    
    // Try PUT if POST fails (function might already exist)
    if (response.status === 409 || error.includes('already exists')) {
      console.log(`  Function exists, updating...`);
      
      const updateResponse = await fetch(`${INSFORGE_BASE_URL}/rest/v1/functions?slug=eq.${fn.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${INSFORGE_API_KEY}`,
          'apikey': INSFORGE_API_KEY,
        },
        body: JSON.stringify({
          name: fn.name,
          description: fn.description,
          code: processedCode,
          status: 'active',
        }),
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update function: ${await updateResponse.text()}`);
      }
      
      console.log(`  ✅ Updated successfully`);
      return;
    }
    
    throw new Error(`Failed to deploy function: ${error}`);
  }
  
  console.log(`  ✅ Deployed successfully`);
}

async function main(): Promise<void> {
  console.log('🚀 Deploying edge functions to InsForge...');
  console.log(`   Backend URL: ${INSFORGE_BASE_URL}`);
  
  for (const fn of FUNCTIONS) {
    try {
      await deployFunction(fn);
    } catch (error) {
      console.error(`  ❌ Failed: ${error}`);
      process.exit(1);
    }
  }
  
  console.log('\n✅ All functions deployed!');
}

main().catch(console.error);
