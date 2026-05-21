import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Notifications-coverage gate.
 *
 * Required by docs/10-testing-strategy.md §12 DoD ("New audit verbs and event
 * topics are referenced in audit-coverage.spec.ts and
 * notifications-coverage.spec.ts").
 *
 * `eventBus.emit` takes a free-form `topic: string`, so the compiler cannot tell
 * us when a new event topic is introduced — and an emitted topic that no
 * subscriber handles is silently dropped. This test guards both: it scans the
 * server source for emitted topics, fails if the set drifts from the registry,
 * and asserts every topic is wired into the notifications service (subscriber
 * list + email template/subject). Sibling of audit-coverage.spec.ts.
 */

// The canonical set of domain event topics. When you emit a new topic, register
// it here, wire a subscriber/template, and add a test that exercises it.
const EXPECTED_EVENT_TOPICS = [
  // stock / item lifecycle
  'item.lowStock',
  'item.outOfStock',
  'item.nearExpiry',
  // request lifecycle
  'request.submitted',
  'request.approved',
  'request.rejected',
  'request.fulfilled',
] as const;

const SERVER_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/server',
);
const NOTIFICATIONS_SERVICE = path.resolve(
  SERVER_DIR,
  'modules/notifications/service.ts',
);

// Matches `eventBus.emit(tx, 'domain.event', ...)` — the literal topic argument.
// Anchored on `.emit(` so it ignores the subscriber `topics` array and the
// `event.topic === '...'` comparisons elsewhere in the source.
const EMIT_TOPIC = /\.emit\(\s*[^,]+,\s*'([a-z][a-zA-Z]*\.[a-zA-Z]+)'/g;

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });
}

function collectEmittedTopics(): Set<string> {
  const found = new Set<string>();
  for (const file of walkTsFiles(SERVER_DIR)) {
    for (const match of readFileSync(file, 'utf8').matchAll(EMIT_TOPIC)) {
      const topic = match[1];
      if (topic) found.add(topic);
    }
  }
  return found;
}

describe('notification topic coverage', () => {
  const emitted = collectEmittedTopics();
  const registry = new Set<string>(EXPECTED_EVENT_TOPICS);
  const notificationsSource = readFileSync(NOTIFICATIONS_SERVICE, 'utf8');

  it('scans the server source and finds emitted topics (guards the scanner)', () => {
    expect(emitted.size).toBeGreaterThan(0);
  });

  it('registers every topic emitted via eventBus.emit()', () => {
    const unregistered = [...emitted].filter((t) => !registry.has(t)).sort();
    expect(
      unregistered,
      'New event topic(s) emitted with no entry in EXPECTED_EVENT_TOPICS. ' +
        'Register them here, wire a subscriber, and add a test that covers each.',
    ).toEqual([]);
  });

  it('has no stale registry entries — every expected topic is still emitted', () => {
    const stale = EXPECTED_EVENT_TOPICS.filter((t) => !emitted.has(t));
    expect(
      stale,
      'Registered event topic(s) are no longer emitted anywhere in the source.',
    ).toEqual([]);
  });

  it('wires every topic into the notifications service (subscriber + template)', () => {
    const unwired = EXPECTED_EVENT_TOPICS.filter(
      (t) => !notificationsSource.includes(`'${t}'`),
    );
    expect(
      unwired,
      'Event topic(s) have no handler/template in modules/notifications/service.ts ' +
        '— they would dispatch to nothing.',
    ).toEqual([]);
  });

  it('uses the <domain>.<event> naming convention for every topic', () => {
    for (const topic of EXPECTED_EVENT_TOPICS) {
      expect(topic, `"${topic}" should be "<domain>.<event>"`).toMatch(
        /^[a-z]+\.[a-zA-Z]+$/,
      );
    }
  });

  it('has no duplicate registry entries', () => {
    expect(registry.size).toBe(EXPECTED_EVENT_TOPICS.length);
  });
});
