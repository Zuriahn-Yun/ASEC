import { createClient } from '@insforge/sdk';

async function main() {
  const client = createClient({
    baseUrl: 'https://q777fgkd.us-west.insforge.app',
    anonKey: 'ik_dbe7d08eea4df8b5d0989f216fef7bdb'
  });
  
  // Check findings for the complete scan
  const { data: findings, error: fe } = await client.database.from('findings').select('scanner,severity,scan_type').limit(20);
  console.log('Findings (first 20):', JSON.stringify(findings));
  console.log('Findings error:', JSON.stringify(fe));

  // Check insertions work
  console.log('\nTest insert (will rollback check)...');
  const { data: inserted, error: ie } = await client.database.from('findings').insert([{
    scan_id: 'a56af70e-b69f-4981-9ae5-4b5d6cf32c1b',
    scanner: 'semgrep',
    scan_type: 'sast',
    severity: 'high',
    title: 'test finding',
  }]).select('id');
  console.log('Insert result:', JSON.stringify(inserted));
  console.log('Insert error:', JSON.stringify(ie));
}
main().catch(console.error);
