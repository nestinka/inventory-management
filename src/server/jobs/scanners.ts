import cron from 'node-cron';
import { prisma } from '@/server/db/client';
import { eventBus } from '@/server/events/bus';
import { env } from '@/env';
import { logger } from '@/server/lib/logger';

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1_000; // 24 h

async function wasRecentlyEmitted(key: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const row = await prisma.notificationDedup.findFirst({
    where: { key, emittedAt: { gte: cutoff } },
  });
  return row !== null;
}

async function recordEmitted(key: string): Promise<void> {
  await prisma.notificationDedup.upsert({
    where: { key },
    create: { key, emittedAt: new Date() },
    update: { emittedAt: new Date() },
  });
}

export async function runLowStockScan(): Promise<void> {
  logger.info('scanner.lowStock: starting');
  const items = await prisma.$queryRaw<Array<{
    id: string; name: string; current_stock: number; reorder_threshold: number;
  }>>`
    SELECT id, name, current_stock, reorder_threshold
    FROM items
    WHERE status = 'ACTIVE'
      AND deleted_at IS NULL
      AND current_stock <= reorder_threshold
  `;

  let lowEmitted = 0;
  let outEmitted = 0;
  for (const item of items) {
    // Match stockService.adjust: stock=0 fires item.outOfStock; non-zero below
    // threshold fires item.lowStock. Distinct dedup keys so a transition
    // between the two states isn't suppressed by the wrong key.
    const isOut = Number(item.current_stock) <= 0;
    const topic = isOut ? 'item.outOfStock' : 'item.lowStock';
    const key = `${isOut ? 'outOfStock' : 'lowStock'}:${item.id}`;
    if (await wasRecentlyEmitted(key)) continue;
    await prisma.$transaction(async (tx) => {
      await eventBus.emit(tx, topic, {
        itemId: item.id,
        name: item.name,
        currentStock: Number(item.current_stock),
        threshold: Number(item.reorder_threshold),
      });
    });
    await recordEmitted(key);
    if (isOut) outEmitted++;
    else lowEmitted++;
  }
  logger.info({ lowEmitted, outEmitted, total: items.length }, 'scanner.lowStock: done');
}

export async function runNearExpiryScan(): Promise<void> {
  logger.info('scanner.nearExpiry: starting');
  const windowMs = env.NEAR_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1_000;
  const cutoff = new Date(Date.now() + windowMs);

  const items = await prisma.item.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      expiryDate: { not: null, lte: cutoff },
    },
    select: { id: true, name: true, expiryDate: true },
  });

  let emitted = 0;
  for (const item of items) {
    const key = `nearExpiry:${item.id}`;
    if (await wasRecentlyEmitted(key)) continue;
    await prisma.$transaction(async (tx) => {
      await eventBus.emit(tx, 'item.nearExpiry', {
        itemId: item.id,
        name: item.name,
        expiryDate: item.expiryDate,
      });
    });
    await recordEmitted(key);
    emitted++;
  }
  logger.info({ emitted, total: items.length }, 'scanner.nearExpiry: done');
}

export function startScanners(): void {
  cron.schedule(env.LOW_STOCK_SCAN_CRON, () => {
    runLowStockScan().catch((err) => logger.error({ err }, 'lowStock scan error'));
  });

  cron.schedule(env.NEAR_EXPIRY_SCAN_CRON, () => {
    runNearExpiryScan().catch((err) => logger.error({ err }, 'nearExpiry scan error'));
  });

  logger.info(
    { lowStockCron: env.LOW_STOCK_SCAN_CRON, nearExpiryCron: env.NEAR_EXPIRY_SCAN_CRON },
    'scanners started',
  );
}
