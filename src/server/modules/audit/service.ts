import { prisma } from '@/server/db/client';
import type { ListAuditLogsInput } from './dto';

export async function listAuditLogs(input: ListAuditLogsInput) {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(input.actorId && { actorId: input.actorId }),
      ...(input.targetType && { targetType: input.targetType }),
      ...(input.targetId && { targetId: input.targetId }),
      ...(input.action && { action: { startsWith: input.action } }),
      ...(input.from && { createdAt: { gte: new Date(input.from) } }),
      ...(input.to && { createdAt: { lte: new Date(input.to) } }),
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: [
      { [input.sortBy ?? 'createdAt']: input.sortDir ?? 'desc' } as Record<string, 'asc' | 'desc'>,
      { id: 'asc' as const },
    ],
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = logs.length > input.limit;
  const page = hasMore ? logs.slice(0, -1) : logs;

  // Resolve friendly names for named targets (ids are not UI-friendly). Query by
  // id regardless of soft-delete/active state so removed entities still show
  // their name. Targets without a name (e.g. request) keep the id fallback.
  const itemIds = new Set<string>();
  const categoryIds = new Set<string>();
  const userIds = new Set<string>();
  for (const log of page) {
    if (!log.targetId) continue;
    if (log.targetType === 'item') itemIds.add(log.targetId);
    else if (log.targetType === 'category') categoryIds.add(log.targetId);
    else if (log.targetType === 'user') userIds.add(log.targetId);
  }

  const [items, categories, users] = await Promise.all([
    itemIds.size
      ? prisma.item.findMany({ where: { id: { in: [...itemIds] } }, select: { id: true, name: true } })
      : [],
    categoryIds.size
      ? prisma.category.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true } })
      : [],
    userIds.size
      ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } })
      : [],
  ]);

  const nameByItem = new Map(items.map((i) => [i.id, i.name]));
  const nameByCategory = new Map(categories.map((c) => [c.id, c.name]));
  const nameByUser = new Map(users.map((u) => [u.id, u.name]));

  const data = page.map((log) => {
    let targetName: string | null = null;
    if (log.targetId) {
      if (log.targetType === 'item') targetName = nameByItem.get(log.targetId) ?? null;
      else if (log.targetType === 'category') targetName = nameByCategory.get(log.targetId) ?? null;
      else if (log.targetType === 'user') targetName = nameByUser.get(log.targetId) ?? null;
    }
    return { ...log, targetName };
  });

  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}
