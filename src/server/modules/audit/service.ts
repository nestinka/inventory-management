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
    orderBy: { createdAt: 'desc' },
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = logs.length > input.limit;
  const data = hasMore ? logs.slice(0, -1) : logs;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}
