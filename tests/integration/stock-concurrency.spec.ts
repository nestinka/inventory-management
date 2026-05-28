import { describe, it, expect, beforeEach } from 'vitest';
import { AdjustmentReason } from '@prisma/client';
import { adjust } from '@/server/modules/stock';
import type { Actor } from '@/server/auth/rbac';
import { prisma, resetDatabase } from '../helpers/db';
import { TestFactory } from '../helpers/factories';

/**
 * T2.1 acceptance: "concurrent adjust unit test using Promise.all proves
 * serialisation." stockService.adjust acquires a row lock via SELECT ... FOR
 * UPDATE; these tests fail loudly if the lock is removed.
 */

function actorFrom(u: { id: string; name: string; email: string; role: string }): Actor {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Actor['role'] };
}

let actor: Actor;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  const f = new TestFactory();
  actor = actorFrom(await f.createUser({ role: 'EDITOR' }));
  categoryId = (await f.createCategory()).id;
});

describe('stockService.adjust — concurrency', () => {
  it('serialises N concurrent decrements: final stock and history are consistent', async () => {
    const f = new TestFactory();
    const item = await f.createItem(categoryId, actor.id);
    await prisma.item.update({
      where: { id: item.id },
      data: { currentStock: 10, reorderThreshold: 0 },
    });

    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        adjust({ itemId: item.id, delta: -1, reason: AdjustmentReason.CONSUMPTION }, actor),
      ),
    );

    expect(results).toHaveLength(N);

    const fresh = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.currentStock).toBe(0);

    const adjustments = await prisma.stockAdjustment.findMany({
      where: { itemId: item.id },
      orderBy: { balanceAfter: 'desc' },
    });
    expect(adjustments).toHaveLength(N);
    // balanceAfter values must be exactly 9, 8, 7, ..., 0 — no duplicates,
    // no skips. Without the row lock, duplicates appear.
    expect(adjustments.map((a) => a.balanceAfter)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('rejects over-allocation under contention: exactly one of N=5 succeeds when stock=1', async () => {
    const f = new TestFactory();
    const item = await f.createItem(categoryId, actor.id);
    await prisma.item.update({
      where: { id: item.id },
      data: { currentStock: 1, reorderThreshold: 0 },
    });

    const N = 5;
    const settled = await Promise.allSettled(
      Array.from({ length: N }, () =>
        adjust({ itemId: item.id, delta: -1, reason: AdjustmentReason.CONSUMPTION }, actor),
      ),
    );

    const fulfilled = settled.filter((r) => r.status === 'fulfilled');
    const rejected = settled.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason?.code).toBe('STOCK_BELOW_ZERO');
    }

    const fresh = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(fresh.currentStock).toBe(0);
    const adjustments = await prisma.stockAdjustment.findMany({ where: { itemId: item.id } });
    expect(adjustments).toHaveLength(1);
  });
});
