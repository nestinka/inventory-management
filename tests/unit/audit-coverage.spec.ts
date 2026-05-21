import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Audit-coverage gate.
 *
 * Required by docs/10-testing-strategy.md (§10 CI step 6 — "fails if any new
 * action verb appears without test coverage"; §12 DoD) and CLAUDE.md ("Every new
 * audit action → row in tests/unit/audit-coverage.spec.ts").
 *
 * `writeAudit` accepts a free-form `action: string`, so the compiler cannot tell
 * us when a new audit verb is introduced. This test is that guard: it scans the
 * server source for emitted audit verbs and fails if the set drifts from the
 * registry below. Adding a `writeAudit({ action: '...' })` therefore forces a
 * deliberate update here — and, with it, the behavioural test that exercises it.
 */

// The canonical set of audit action verbs. When you add a new writeAudit() call,
// register the verb here and add a service/integration test that emits it.
const EXPECTED_AUDIT_ACTIONS = [
  // categories
  'category.create',
  'category.update',
  'category.activate',
  'category.deactivate',
  // items
  'item.create',
  'item.update',
  'item.delete',
  // stock
  'stock.adjust',
  // requests
  'request.create',
  'request.approve',
  'request.reject',
  'request.cancel',
  'request.fulfil',
  // users
  'user.create',
  'user.update',
  'user.delete',
  'user.password_reset',
] as const;

type AuditAction = (typeof EXPECTED_AUDIT_ACTIONS)[number];

const SERVER_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/server',
);

// Matches `action: 'domain.verb'` — the literal passed to writeAudit(). The
// dotted lower-snake shape excludes the audit DTO's `action: z.string()` filter
// field and any empty `action: ''` in UI code.
const ACTION_LITERAL = /\baction:\s*'([a-z][a-z_]*\.[a-z][a-z_]*)'/g;

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

function collectEmittedActions(): Set<string> {
  const found = new Set<string>();
  for (const file of walkTsFiles(SERVER_DIR)) {
    for (const match of readFileSync(file, 'utf8').matchAll(ACTION_LITERAL)) {
      const verb = match[1];
      if (verb) found.add(verb);
    }
  }
  return found;
}

describe('audit action coverage', () => {
  const emitted = collectEmittedActions();
  const registry = new Set<string>(EXPECTED_AUDIT_ACTIONS);

  it('scans the server source and finds audit verbs (guards the scanner itself)', () => {
    expect(emitted.size).toBeGreaterThan(0);
  });

  it('registers every audit verb emitted in the server source', () => {
    const unregistered = [...emitted].filter((a) => !registry.has(a)).sort();
    expect(
      unregistered,
      'New audit verb(s) emitted via writeAudit() with no entry in ' +
        'EXPECTED_AUDIT_ACTIONS. Register them here and add a test that covers each.',
    ).toEqual([]);
  });

  it('has no stale registry entries — every expected verb is still emitted', () => {
    const stale = EXPECTED_AUDIT_ACTIONS.filter((a) => !emitted.has(a));
    expect(
      stale,
      'Registered audit verb(s) are no longer emitted anywhere in the source.',
    ).toEqual([]);
  });

  it('uses the <domain>.<verb> naming convention for every verb', () => {
    for (const action of EXPECTED_AUDIT_ACTIONS) {
      expect(action, `"${action}" should be "<domain>.<verb>"`).toMatch(
        /^[a-z]+\.[a-z_]+$/,
      );
    }
  });

  it('has no duplicate registry entries', () => {
    expect(registry.size).toBe(EXPECTED_AUDIT_ACTIONS.length);
  });

  it('exposes each known target domain at least once', () => {
    const domains = new Set<string>(
      EXPECTED_AUDIT_ACTIONS.map((a: AuditAction) => a.slice(0, a.indexOf('.'))),
    );
    expect([...domains].sort()).toEqual([
      'category',
      'item',
      'request',
      'stock',
      'user',
    ]);
  });
});
