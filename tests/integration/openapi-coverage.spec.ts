import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * OpenAPI / contract coverage (docs/10-testing-strategy.md §10 CI step 7 —
 * "fails if any route lacks a documented schema").
 *
 * Every write route (POST/PUT/PATCH) must validate its input against a zod DTO
 * (the documented contract) — either via withRoute's `body:` option or a manual
 * `SomeDto.safeParse(...)`. Path-only mutations that legitimately take no body
 * are listed explicitly so adding a new unvalidated write route fails the gate.
 */

const API_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/app/api/v1',
);

const WRITE_METHOD = /export\s+(?:async\s+function|const)\s+(?:POST|PUT|PATCH)\b/;
const DTO_REFERENCE = /\b\w+Dto\b/;

// Write routes that intentionally carry no request body (only a path param or
// session). Keyed by path relative to API_DIR, using forward slashes.
const BODYLESS_WRITES = new Set<string>([
  'notifications/route.ts', // POST = mark all read
  'requests/[id]/cancel/route.ts', // POST = cancel by id
]);

function walkRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkRouteFiles(full);
    return entry.isFile() && entry.name === 'route.ts' ? [full] : [];
  });
}

const rel = (file: string) => path.relative(API_DIR, file).split(path.sep).join('/');

describe('openapi coverage — write routes document their input schema', () => {
  const files = walkRouteFiles(API_DIR);

  it('finds the v1 route files (guards the scanner)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every write route validates via a zod DTO or is an allowlisted body-less mutation', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!WRITE_METHOD.test(src)) continue;
      const relPath = rel(file);
      if (DTO_REFERENCE.test(src)) continue;
      if (BODYLESS_WRITES.has(relPath)) continue;
      offenders.push(relPath);
    }
    expect(
      offenders,
      'write route(s) accept input without a documented zod schema',
    ).toEqual([]);
  });

  it('has no stale entries in the body-less allowlist', () => {
    const present = new Set(files.map(rel));
    const stale = [...BODYLESS_WRITES].filter((p) => !present.has(p));
    expect(stale, 'allowlisted route(s) no longer exist').toEqual([]);
  });
});
