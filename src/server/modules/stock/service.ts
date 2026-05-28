import { prisma } from '@/server/db/client';
import { eventBus } from '@/server/events/bus';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import type { AdjustStockInput, ListAdjustmentsInput } from './dto';

export async function adjust(input: AdjustStockInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE serialises concurrent adjusts on the same item.
    // Without the row lock, two transactions can both read the same balance,
    // both pass the >= 0 check, and write inconsistent balanceAfter values.
    const rows = await tx.$queryRaw<Array<{
      id: string;
      name: string;
      current_stock: number;
      reorder_threshold: number;
      deleted_at: Date | null;
    }>>`SELECT id, name, current_stock, reorder_threshold, deleted_at
        FROM items
        WHERE id = ${input.itemId}::uuid
        FOR UPDATE`;
    const row = rows[0];
    if (!row || row.deleted_at) throw new ApiError('NOT_FOUND', 404, `Item ${input.itemId} not found`);
    const item = {
      id: row.id,
      name: row.name,
      currentStock: Number(row.current_stock),
      reorderThreshold: Number(row.reorder_threshold),
    };

    const newStock = Math.round((item.currentStock + input.delta) * 100) / 100;
    if (newStock < 0) {
      throw new ApiError(
        'STOCK_BELOW_ZERO',
        409,
        `Adjustment would result in negative stock (current: ${item.currentStock}, delta: ${input.delta})`,
      );
    }

    const updatedItem = await tx.item.update({
      where: { id: item.id },
      data: { currentStock: newStock },
    });

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

    return { item: updatedItem, adjustment };
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
