import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Per-worker setup for the integration project. Runs before each test file's
 * imports, so the env that src/env.ts requires (it calls process.exit(1) on
 * missing vars) and the container DATABASE_URL are in place before the app's
 * prisma singleton is constructed.
 */

const DB_URL_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.test-db-url',
);

if (!process.env.DATABASE_URL && existsSync(DB_URL_FILE)) {
  process.env.DATABASE_URL = readFileSync(DB_URL_FILE, 'utf8').trim();
}

process.env.NEXTAUTH_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.NEXTAUTH_URL ??= 'http://localhost:7000';
process.env.APP_BASE_URL ??= 'http://localhost:7000';
// The rbac-matrix spec makes many requests per actor; lift the per-user cap so
// the in-memory rate limiter never trips during a run.
process.env.RATE_LIMIT_API_PER_MIN ??= '100000';
process.env.DISABLE_BACKGROUND_JOBS ??= 'true';
