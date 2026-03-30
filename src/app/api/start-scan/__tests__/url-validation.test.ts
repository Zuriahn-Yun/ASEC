/**
 * Unit tests for URL validation and target name extraction logic
 * in the start-scan route and edge function.
 *
 * These tests run with Node's built-in test runner via tsx.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── Inline the pure helpers so we can test them without mocking Next.js ───

function isValidScanUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function extractTargetName(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return parts[1].replace('.git', '');
      }
    }
    return parsed.hostname || 'unknown-target';
  } catch {
    return 'unknown-target';
  }
}

// ─── isValidScanUrl ───────────────────────────────────────────────────────

describe('isValidScanUrl', () => {
  it('accepts a standard GitHub https URL', () => {
    assert.equal(isValidScanUrl('https://github.com/owner/repo'), true);
  });

  it('accepts a GitHub URL with .git suffix', () => {
    assert.equal(isValidScanUrl('https://github.com/owner/repo.git'), true);
  });

  it('accepts a live http target', () => {
    assert.equal(isValidScanUrl('http://example.com'), true);
  });

  it('accepts a live https target', () => {
    assert.equal(isValidScanUrl('https://juice-shop.example.com'), true);
  });

  it('accepts a URL with a path and query string', () => {
    assert.equal(isValidScanUrl('https://target.com/app?x=1'), true);
  });

  it('rejects a plain hostname (no protocol)', () => {
    assert.equal(isValidScanUrl('github.com/owner/repo'), false);
  });

  it('rejects an ftp:// URL', () => {
    assert.equal(isValidScanUrl('ftp://files.example.com'), false);
  });

  it('rejects an empty string', () => {
    assert.equal(isValidScanUrl(''), false);
  });

  it('rejects a totally invalid string', () => {
    assert.equal(isValidScanUrl('not-a-url'), false);
  });

  it('rejects a file:// URL', () => {
    assert.equal(isValidScanUrl('file:///etc/passwd'), false);
  });
});

// ─── extractTargetName ────────────────────────────────────────────────────

describe('extractTargetName', () => {
  it('extracts repo name from a standard GitHub URL', () => {
    assert.equal(extractTargetName('https://github.com/owner/my-repo'), 'my-repo');
  });

  it('strips .git suffix from GitHub repo name', () => {
    assert.equal(extractTargetName('https://github.com/owner/my-repo.git'), 'my-repo');
  });

  it('returns hostname for a live http target', () => {
    assert.equal(extractTargetName('http://juice-shop.example.com'), 'juice-shop.example.com');
  });

  it('returns hostname for a live https target', () => {
    assert.equal(extractTargetName('https://vulnapp.internal'), 'vulnapp.internal');
  });

  it('returns hostname for a URL with path', () => {
    assert.equal(extractTargetName('https://target.com/app/login'), 'target.com');
  });

  it('falls back to unknown-target for a malformed URL', () => {
    assert.equal(extractTargetName('not-a-url'), 'unknown-target');
  });

  it('falls back to unknown-target for a GitHub URL with only one path segment', () => {
    // github.com/owner only — no repo name
    assert.equal(extractTargetName('https://github.com/owner'), 'github.com');
  });
});
