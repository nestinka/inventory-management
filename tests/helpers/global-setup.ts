import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

/**
 * Vitest globalSetup for the integration project.
 *
 * Boots a throwaway Postgres (Testcontainers), applies the committed Prisma
 * migrations, and publishes the connection string two ways:
 *   1. process.env.DATABASE_URL — inherited by the (single) forked worker.
 *   2. a sidecar file read by integration-setup.ts before any app import — so
 *      the app's prisma singleton connects to the container regardless of how
 *      env propagates across the pool boundary.
 *
 * See docs/10-testing-strategy.md §6.
 */

const DB_URL_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.test-db-url',
);

let container: StartedTestContainer | undefined;

export async function setup(): Promise<void> {
  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'inventory_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .start();

  const url =
    `postgresql://test:test@${container.getHost()}:` +
    `${container.getMappedPort(5432)}/inventory_test?schema=public`;

  process.env.DATABASE_URL = url;
  writeFileSync(DB_URL_FILE, url, 'utf8');

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}

export async function teardown(): Promise<void> {
  try {
    rmSync(DB_URL_FILE, { force: true });
  } catch {
    // best-effort
  }
  await container?.stop();
}
