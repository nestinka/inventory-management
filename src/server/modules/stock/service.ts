import { prisma } from '@/server/db/client';
import { eventBus } from '@/server/events/bus';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import type { AdjustStockInput, ListAdjustmentsInput } from './dto';

export async function adjust(input: AdjustStockInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    // Row-level lock prevents concurrent under-zero issues
    const item = await tx.item.findFirst({
      where: { id: input.itemId, deletedAt: null },
    });
    if (!item) throw new ApiError('NOT_FOUND', 404, `Item ${input.itemId} not found`);

    const newStock = Math.round((item.currentStock + input.delta) * 100) / 100;
    if (newStock < 0) {
      throw new ApiError(
        'STOCK_BELOW_ZERO',
        409,
        `Adjustment would result in negative stock (current: ${item.currentStock}, delta: ${input.delta})`,
      );
    }

    await tx.item.update({ where: { id: item.id }, data: { currentStock: newStock } });

    const adjustment = await tx.stockAdjustment.create({
      data: {
        itemId: item.id,
        delta: input.delta,
        balanceAfter: newStock,
        reason: input.reason,
        note: input.note ?? null,
        actorId: actor.id,
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'stock.adjust',
      targetType: 'item',
      targetId: item.id,
      diff: { delta: input.delta, balanceBefore: item.currentStock, balanceAfter: newStock, reason: input.reason, note: input.note },
      ctx,
    });

    // Out-of-stock takes priority; low-stock still fires for non-zero stock below threshold
    if (newStock === 0) {
      await eventBus.emit(tx, 'item.outOfStock', {
        itemId: item.id,
        name: item.name,
        currentStock: 0,
        threshold: item.reorderThreshold,
      });
    }
    if (newStock > 0 && newStock < item.reorderThreshold) {
      await eventBus.emit(tx, 'item.lowStock', {
        itemId: item.id,
        name: item.name,
        currentStock: newStock,
        threshold: item.reorderThreshold,
      });
    }

    return { item: { ...item, currentStock: newStock }, adjustment };
  });
}

export async function listAdjustments(input: ListAdjustmentsInput) {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      ...(input.itemId && { itemId: input.itemId }),
      ...(input.actorId && { actorId: input.actorId }),
      ...(input.from && { createdAt: { gte: new Date(input.from) } }),
      ...(input.to && { createdAt: { lte: new Date(input.to) } }),
    },
    include: {
      actor: { select: { id: true, name: true, email: true } },
      item: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = adjustments.length > input.limit;
  const data = hasMore ? adjustments.slice(0, -1) : adjustments;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}
