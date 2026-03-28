import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@insforge/sdk';
import type { ScanFinding, Fix, SeverityLevel } from '../../shared/types';

type FixWithoutMeta = Omit<Fix, 'id' | 'created_at'>;

// Load prompt templates
const PROMPTS_DIR = join(import.meta.dirname ?? __dirname, '..', 'templates', 'prompts');

function loadPrompt(name: string): string {
  return readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf-8');
}

// InsForge client -- initialized lazily
let _client: ReturnType<typeof createClient> | null = null;

function getClient(): ReturnType<typeof createClient> {
  if (!_client) {
    const baseUrl = process.env.INSFORGE_URL || process.env.INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || 'https://66wjtrxb.us-west.insforge.app';
    const anonKey = process.env.INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || '';
    _client = createClient({ baseUrl, anonKey });
  }
  return _client;
}

interface TriageResult {
  index: number;
  adjusted_severity: SeverityLevel;
  is_duplicate: boolean;
  duplicate_of_index: number | null;
  reasoning: string;
}

/**
 * Send findings to AI for triage: dedup, re-assess severity, prioritize.
 * Limits to top 50 findings to control token usage.
 */
export async function triageFindings(
  findings: ScanFinding[]
): Promise<ScanFinding[]> {
  if (findings.length === 0) return findings;

  const toTriage: ScanFinding[] = findings.slice(0, 50);
  const triagePrompt = loadPrompt('triage');

  try {
    const client = getClient();
    const response = await (client as any).ai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        { role: 'system', content: triagePrompt },
        {
          role: 'user',
          content: JSON.stringify(
            toTriage.map((f, i) => ({
              index: i,
              scanner: f.scanner,
              scan_type: f.scan_type,
              severity: f.severity,
              title: f.title,
              description: f.description,
              file_path: f.file_path,
              cwe_id: f.cwe_id,
            }))
          ),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[ai-analyzer] No response from AI triage, returning original findings');
      return findings;
    }

    const triageResults: TriageResult[] = JSON.parse(content);

    // Apply triage results: filter duplicates, update severity
    const deduped: ScanFinding[] = [];
    for (const result of triageResults) {
      if (result.is_duplicate) continue;
      if (result.index >= toTriage.length) continue;

      const finding = { ...toTriage[result.index] };
      finding.severity = result.adjusted_severity;
      deduped.push(finding);
    }

    // Append any findings beyond the top 50 that weren't triaged
    const remaining = findings.slice(50);
    return [...deduped, ...remaining];
  } catch (err) {
    console.error('[ai-analyzer] Triage failed, returning original findings:', err);
    return findings;
  }
}

interface FixAIResponse {
  explanation: string;
  original_code: string;
  fixed_code: string;
  diff_patch: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ExplanationAIResponse {
  plain_explanation: string;
}

/**
 * For top critical/high findings with file paths, generate code fixes using AI.
 * Limits to 20 findings to control token usage and latency.
 */
export async function generateFixes(
  findings: ScanFinding[],
  repoDir: string,
  scanId: string
): Promise<FixWithoutMeta[]> {
  const fixable = findings
    .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.file_path)
    .slice(0, 20);

  if (fixable.length === 0) return [];

  const fixPrompt = loadPrompt('fix');
  const client = getClient();
  const fixes: FixWithoutMeta[] = [];

  for (const finding of fixable) {
    try {
      // Read source code
      const filePath = join(repoDir, finding.file_path!);
      let sourceCode: string;
      try {
        sourceCode = readFileSync(filePath, 'utf-8');
      } catch {
        console.warn(`[ai-analyzer] Could not read ${filePath}, skipping fix generation`);
        continue;
      }

      // Truncate very large files to avoid token limits
      const maxChars = 15_000;
      const truncated = sourceCode.length > maxChars
        ? sourceCode.slice(0, maxChars) + '\n// ... (truncated)'
        : sourceCode;

      const response = await (client as any).ai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: fixPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              vulnerability: {
                title: finding.title,
                description: finding.description,
                severity: finding.severity,
                cwe_id: finding.cwe_id,
                file_path: finding.file_path,
                line_start: finding.line_start,
              },
              source_code: truncated,
            }),
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) continue;

      const aiResult: FixAIResponse = JSON.parse(content);

      fixes.push({
        finding_id: finding.id,
        scan_id: scanId,
        explanation: aiResult.explanation,
        original_code: aiResult.original_code,
        fixed_code: aiResult.fixed_code,
        diff_patch: aiResult.diff_patch,
        confidence: aiResult.confidence,
      });
    } catch (err) {
      console.error(`[ai-analyzer] Fix generation failed for "${finding.title}":`, err);
      // Continue with next finding
    }
  }

  return fixes;
}

/**
 * Generate plain-language explanations for findings.
 * Explains security issues to developers with no security background.
 * Processes findings in batches of 5-10 to control token usage.
 */
export async function generateExplanations(
  findings: ScanFinding[]
): Promise<ScanFinding[]> {
  if (findings.length === 0) return findings;

  const BATCH_SIZE = 8;
  const client = getClient();
  const explained: ScanFinding[] = [];

  // Process in batches
  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE);

    try {
      const response = await (client as any).ai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content: `You are a security expert explaining vulnerabilities to developers with NO security background.

For each finding, provide a plain_explanation that covers:
1. What's wrong — one sentence, no jargon, no CWE codes
2. Why it matters — real-world risk in plain English
3. How to fix — actionable step, specific to the file/line

Format your response as JSON array:
[
  { "plain_explanation": "User input is being inserted directly into a database query on line 42 of db.py. An attacker could type specially crafted text to read, change, or delete your database. Fix: use parameterized queries instead of string concatenation." },
  ...
]

Rules:
- No raw CWE codes (explain what they mean)
- No "vulnerability" without context
- Reference specific file paths and line numbers
- One paragraph per finding, three parts
- Use simple language a junior developer would understand`,
          },
          {
            role: 'user',
            content: JSON.stringify(
              batch.map((f) => ({
                title: f.title,
                description: f.description,
                severity: f.severity,
                file_path: f.file_path,
                line_start: f.line_start,
                line_end: f.line_end,
                scanner: f.scanner,
                scan_type: f.scan_type,
                cwe_id: f.cwe_id,
                rule_id: f.rule_id,
              }))
            ),
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[ai-analyzer] No response from explanation generation, keeping original descriptions');
        explained.push(...batch);
        continue;
      }

      const explanations: ExplanationAIResponse[] = JSON.parse(content);

      // Merge explanations back into findings
      for (let j = 0; j < batch.length; j++) {
        const finding = { ...batch[j] };
        if (explanations[j]?.plain_explanation) {
          finding.description = explanations[j].plain_explanation;
        }
        explained.push(finding);
      }
    } catch (err) {
      console.error('[ai-analyzer] Explanation generation failed for batch:', err);
      // Keep original findings on error
      explained.push(...batch);
    }
  }

  return explained;
}
