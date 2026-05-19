import { prisma } from '@/server/db/client';
import { eventBus } from './bus';
import { logger } from '@/server/lib/logger';

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 10;

let timer: ReturnType<typeof setTimeout> | null = null;

async function poll(): Promise<void> {
  const now = new Date();
  const rows = await prisma.eventOutbox.findMany({
    where: {
      dispatchedAt: null,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  });

  for (const row of rows) {
    try {
      await eventBus.dispatch({
        id: row.id,
        topic: row.topic,
        payload: row.payload,
        createdAt: row.createdAt,
        attempts: row.attempts,
      });

      await prisma.eventOutbox.update({
        where: { id: row.id },
        data: { dispatchedAt: new Date() },
      });
    } catch (err) {
      const nextAttempts = row.attempts + 1;
      const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1_000, 3_600_000);
      await prisma.eventOutbox.update({
        where: { id: row.id },
        data: {
          attempts: nextAttempts,
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
      logger.warn({ topic: row.topic, eventId: row.id, attempts: nextAttempts }, 'event dispatch failed, will retry');
    }
  }
}

export function startDispatcher(): void {
  function schedule() {
    timer = setTimeout(async () => {
      await poll().catch((err) => logger.error({ err }, 'dispatcher poll error'));
      schedule();
    }, POLL_INTERVAL_MS);
  }
  schedule();
  logger.info('event dispatcher started');
}

export function stopDispatcher(): void {
  if (timer) clearTimeout(timer);
}
