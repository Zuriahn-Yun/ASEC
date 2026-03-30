/**
 * Scanner validation script — runs SAST, SCA, and DAST against Juice Shop
 * and writes results to SCAN_TEST_RESULTS.md in the repo root.
 *
 * Usage: npx tsx src/test-scanners.ts
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSemgrep } from './scanners/semgrep.js';
import { runTrivy } from './scanners/trivy.js';
import { runNpmAudit } from './scanners/npm-audit.js';
import { runNuclei } from './scanners/nuclei.js';
import { runZap } from './scanners/zap.js';

const JUICE_SHOP_DIR = '/tmp/juice-shop';
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const RESULTS_PATH = join(REPO_ROOT, 'SCAN_TEST_RESULTS.md');

/** Resolve the best DAST target: local container first, public demo as fallback. */
async function resolveDastTarget(): Promise<string> {
  const LOCAL = 'http://localhost:3001';
  try {
    const res = await fetch(LOCAL, { signal: AbortSignal.timeout(3000) });
    if (res.status < 500) {
      console.log(`[DAST] Local Juice Shop at ${LOCAL} is reachable (HTTP ${res.status}) — using local target.`);
      return LOCAL;
    }
  } catch {
    // not reachable
  }
  console.log('[DAST] Local Juice Shop not reachable, falling back to demo.owasp-juice.shop');
  return 'https://demo.owasp-juice.shop';
}

async function main() {
  const DAST_TARGET = await resolveDastTarget();
  const timestamp = new Date().toISOString();
  const lines: string[] = [
    '# SCAN_TEST_RESULTS.md',
    '',
    `**Generated:** ${timestamp}`,
    `**Target repo:** ${JUICE_SHOP_DIR} (https://github.com/juice-shop/juice-shop)`,
    `**DAST target:** ${DAST_TARGET}`,
    '',
    '---',
    '',
  ];

  // ── SAST ────────────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: SAST (Semgrep) ===');
  lines.push('## SAST — Semgrep');
  const sastStart = Date.now();
  const sastFindings = await runSemgrep(JUICE_SHOP_DIR).catch((e) => {
    console.error('[SAST] Error:', e);
    return [];
  });
  const sastElapsed = ((Date.now() - sastStart) / 1000).toFixed(1);

  console.log(`SAST result: ${sastFindings.length} findings in ${sastElapsed}s`);
  lines.push('');
  lines.push(`- **Findings:** ${sastFindings.length}`);
  lines.push(`- **Duration:** ${sastElapsed}s`);
  lines.push('');

  if (sastFindings.length > 0) {
    lines.push('### Top 10 SAST Findings');
    lines.push('');
    lines.push('| Severity | Rule | File | Line |');
    lines.push('|---|---|---|---|');
    for (const f of sastFindings.slice(0, 10)) {
      lines.push(`| ${f.severity} | \`${f.rule_id ?? 'N/A'}\` | ${f.file_path ?? 'N/A'} | ${f.line_start ?? '-'} |`);
    }
  } else {
    lines.push('> ⚠️ No SAST findings — scanner may be misconfigured.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // ── SCA: Trivy ──────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: SCA (Trivy) ===');
  lines.push('## SCA — Trivy');
  const trivyStart = Date.now();
  const trivyFindings = await runTrivy(JUICE_SHOP_DIR, 'test-scan').catch((e) => {
    console.error('[SCA/Trivy] Error:', e);
    return [];
  });
  const trivyElapsed = ((Date.now() - trivyStart) / 1000).toFixed(1);

  console.log(`Trivy result: ${trivyFindings.length} findings in ${trivyElapsed}s`);
  lines.push('');
  lines.push(`- **Findings:** ${trivyFindings.length}`);
  lines.push(`- **Duration:** ${trivyElapsed}s`);
  lines.push('');

  if (trivyFindings.length > 0) {
    lines.push('### Top 10 Trivy Findings');
    lines.push('');
    lines.push('| Severity | Title | File |');
    lines.push('|---|---|---|');
    for (const f of trivyFindings.slice(0, 10)) {
      lines.push(`| ${f.severity} | ${f.title.slice(0, 80)} | ${f.file_path ?? 'N/A'} |`);
    }
  } else {
    lines.push('> ⚠️ No Trivy findings — scanner may be misconfigured or lockfile missing.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // ── SCA: npm audit ──────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: SCA (npm audit) ===');
  lines.push('## SCA — npm audit');
  const npmStart = Date.now();
  const npmFindings = await runNpmAudit(JUICE_SHOP_DIR, 'test-scan').catch((e) => {
    console.error('[SCA/npm] Error:', e);
    return [];
  });
  const npmElapsed = ((Date.now() - npmStart) / 1000).toFixed(1);

  console.log(`npm audit result: ${npmFindings.length} findings in ${npmElapsed}s`);
  lines.push('');
  lines.push(`- **Findings:** ${npmFindings.length}`);
  lines.push(`- **Duration:** ${npmElapsed}s`);
  lines.push('');

  if (npmFindings.length > 0) {
    lines.push('### Top 10 npm audit Findings');
    lines.push('');
    lines.push('| Severity | Package | CWE |');
    lines.push('|---|---|---|');
    for (const f of npmFindings.slice(0, 10)) {
      lines.push(`| ${f.severity} | ${f.rule_id ?? 'N/A'} | ${f.cwe_id ?? 'N/A'} |`);
    }
  } else {
    lines.push('> ⚠️ No npm audit findings.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // ── DAST: Nuclei ────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: DAST (Nuclei) ===');
  lines.push('## DAST — Nuclei');
  const nucleiStart = Date.now();
  const nucleiFindings = await runNuclei(DAST_TARGET).catch((e) => {
    console.error('[DAST/Nuclei] Error:', e);
    return [];
  });
  const nucleiElapsed = ((Date.now() - nucleiStart) / 1000).toFixed(1);

  console.log(`Nuclei result: ${nucleiFindings.length} findings in ${nucleiElapsed}s`);
  lines.push('');
  lines.push(`- **Findings:** ${nucleiFindings.length}`);
  lines.push(`- **Target:** ${DAST_TARGET}`);
  lines.push(`- **Duration:** ${nucleiElapsed}s`);
  lines.push('');

  if (nucleiFindings.length > 0) {
    lines.push('### Nuclei Findings');
    lines.push('');
    lines.push('| Severity | Template | URL |');
    lines.push('|---|---|---|');
    for (const f of nucleiFindings) {
      lines.push(`| ${f.severity} | \`${f.rule_id ?? 'N/A'}\` | ${f.file_path ?? 'N/A'} |`);
    }
  } else {
    lines.push('> ⚠️ No Nuclei findings.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // ── DAST: ZAP ───────────────────────────────────────────────────────────────
  console.log('\n=== PHASE 3: DAST (ZAP) ===');
  lines.push('## DAST — OWASP ZAP');
  const zapStart = Date.now();
  const zapFindings = await runZap(DAST_TARGET).catch((e) => {
    console.error('[DAST/ZAP] Error:', e);
    return [];
  });
  const zapElapsed = ((Date.now() - zapStart) / 1000).toFixed(1);

  console.log(`ZAP result: ${zapFindings.length} findings in ${zapElapsed}s`);
  lines.push('');
  lines.push(`- **Findings:** ${zapFindings.length}`);
  lines.push(`- **Target:** ${DAST_TARGET}`);
  lines.push(`- **Duration:** ${zapElapsed}s`);
  lines.push('');

  if (zapFindings.length > 0) {
    lines.push('### ZAP Findings');
    lines.push('');
    lines.push('| Severity | Name | CWE |');
    lines.push('|---|---|---|');
    for (const f of zapFindings) {
      lines.push(`| ${f.severity} | ${f.title} | ${f.cwe_id ?? 'N/A'} |`);
    }
  } else {
    lines.push('> ⚠️ No ZAP findings.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = sastFindings.length + trivyFindings.length + npmFindings.length + nucleiFindings.length + zapFindings.length;
  lines.push('## Summary');
  lines.push('');
  lines.push('| Scanner | Type | Findings |');
  lines.push('|---|---|---|');
  lines.push(`| Semgrep | SAST | ${sastFindings.length} |`);
  lines.push(`| Trivy | SCA | ${trivyFindings.length} |`);
  lines.push(`| npm audit | SCA | ${npmFindings.length} |`);
  lines.push(`| Nuclei | DAST | ${nucleiFindings.length} |`);
  lines.push(`| ZAP | DAST | ${zapFindings.length} |`);
  lines.push(`| **Total** | | **${total}** |`);
  lines.push('');

  const pass = sastFindings.length > 0 && (trivyFindings.length + npmFindings.length) > 0 && (nucleiFindings.length + zapFindings.length) > 0;
  lines.push(pass ? '✅ **PASS** — All three scanner categories returned real findings.' : '❌ **FAIL** — One or more scanner categories returned 0 findings.');

  await writeFile(RESULTS_PATH, lines.join('\n'), 'utf-8');
  console.log(`\n✅ Results written to ${RESULTS_PATH}`);
  console.log(`Total findings: SAST=${sastFindings.length} Trivy=${trivyFindings.length} npm=${npmFindings.length} Nuclei=${nucleiFindings.length} ZAP=${zapFindings.length}`);

  if (!pass) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});
