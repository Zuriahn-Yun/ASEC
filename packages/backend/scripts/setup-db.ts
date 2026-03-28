#!/usr/bin/env node
/**
 * Database setup script for ASEC
 * 
 * Creates all database tables in InsForge by executing the SQL schema.
 * Run with: npm run setup-db
 */

import { createClient } from '@insforge/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize InsForge client
const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || 'https://66wjtrxb.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

/**
 * Execute a single SQL statement
 */
async function executeSql(statement: string): Promise<void> {
  const { error } = await insforge.database.rpc('exec_sql', {
    query: statement,
  });

  if (error) {
    throw new Error(`SQL execution failed: ${error.message}`);
  }
}

/**
 * Main setup function
 */
async function setupDatabase(): Promise<void> {
  console.log('🔧 ASEC Database Setup\n');

  // Check for anon key
  if (!process.env.INSFORGE_ANON_KEY) {
    console.warn('⚠️  Warning: INSFORGE_ANON_KEY not set. Using empty string.');
    console.warn('   Set it with: export INSFORGE_ANON_KEY=your-key\n');
  }

  // Read schema.sql
  const schemaPath = path.join(__dirname, '../sql/schema.sql');
  console.log(`📖 Reading schema from: ${schemaPath}`);

  let sql: string;
  try {
    sql = fs.readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    console.error('❌ Failed to read schema.sql:', err);
    process.exit(1);
  }

  // Split SQL into individual statements
  // Handle statements that may span multiple lines (like CREATE TABLE)
  const statements: string[] = [];
  let currentStatement = '';
  let inFunction = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('--') || trimmed === '') {
      continue;
    }

    // Track if we're inside a function definition
    if (trimmed.toLowerCase().includes('create or replace function')) {
      inFunction = true;
    }

    currentStatement += line + '\n';

    // Check for statement end
    if (!inFunction && trimmed.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    } else if (inFunction && trimmed === '$$;') {
      statements.push(currentStatement.trim());
      currentStatement = '';
      inFunction = false;
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const firstLine = statement.split('\n')[0].substring(0, 60);
    const description = firstLine.length > 60 ? firstLine + '...' : firstLine;

    process.stdout.write(`  [${i + 1}/${statements.length}] ${description} ... `);

    try {
      await executeSql(statement);
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log('❌');
      console.error(`     Error: ${err}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
  }
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }

  console.log('\n🎉 Database setup complete!');
}

// Run setup
setupDatabase().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
