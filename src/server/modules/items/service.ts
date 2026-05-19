import { ItemStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { writeAudit } from '@/server/lib/audit';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import * as repo from './repo';
import type { CreateItemInput, UpdateItemInput, ListItemsInput } from './dto';

export const listItems = repo.findMany;
export const getItem = repo.findById;

const itemInclude = { category: { select: { id: true, name: true } } };

export async function createItem(input: CreateItemInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        unitOfMeasure: input.unitOfMeasure,
        categoryId: input.categoryId,
        currentStock: input.currentStock,
        reorderThreshold: input.reorderThreshold,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        status: input.status ?? ItemStatus.ACTIVE,
        createdById: actor.id,
      },
      include: itemInclude,
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'item.create',
      targetType: 'item',
      targetId: created.id,
      diff: { after: created },
      ctx,
    });

    return created;
  });
}

export async function updateItem(id: string, input: UpdateItemInput, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  return prisma.$transaction(async (tx) => {
    const after = await tx.item.update({
      where: { id },
      data: {
        ...input,
        expiryDate: input.expiryDate !== undefined
          ? (input.expiryDate ? new Date(input.expiryDate) : null)
          : undefined,
      },
      include: itemInclude,
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'item.update',
      targetType: 'item',
      targetId: id,
      diff: { before, after },
      ctx,
    });

    return after;
  });
}

export async function deleteItem(id: string, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  await prisma.$transaction(async (tx) => {
    await tx.item.update({ where: { id }, data: { deletedAt: new Date(), status: ItemStatus.DISCONTINUED } });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'item.delete',
      targetType: 'item',
      targetId: id,
      diff: { before, after: { deletedAt: new Date() } },
      ctx,
    });
  });
}

export async function getItemHistory(id: string, input: ListItemsInput) {
  await repo.findById(id);
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { itemId: id },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: (input.limit ?? 50) + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });
  const hasMore = adjustments.length > (input.limit ?? 50);
  const data = hasMore ? adjustments.slice(0, -1) : adjustments;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}
