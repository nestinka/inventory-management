import { prisma } from '@/server/db/client';
import { writeAudit } from '@/server/lib/audit';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import * as repo from './repo';
import type { CreateItemInput, UpdateItemInput, ListItemsInput } from './dto';

export const listItems = repo.findMany;
export const getItem = repo.findById;

export async function createItem(input: CreateItemInput, actor: Actor, ctx?: AuditContext) {
  const item = await prisma.$transaction(async (tx) => {
    const created = await repo.create(input, actor.id);
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
  return item;
}

export async function updateItem(id: string, input: UpdateItemInput, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  const item = await prisma.$transaction(async (tx) => {
    const after = await repo.update(id, input);
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
  return item;
}

export async function deleteItem(id: string, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  await prisma.$transaction(async (tx) => {
    await repo.softDelete(id);
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
