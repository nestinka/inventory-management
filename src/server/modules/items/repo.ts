import { ItemStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { ApiError } from '@/server/lib/errors';
import { deriveStockState } from './domain';
import type { CreateItemInput, UpdateItemInput, ListItemsInput } from './dto';

const itemInclude = { category: { select: { id: true, name: true } } };

function withStockState<T extends { currentStock: number; reorderThreshold: number }>(item: T) {
  return { ...item, stockState: deriveStockState(item.currentStock, item.reorderThreshold) };
}

export async function findMany(input: ListItemsInput) {
  const now = new Date();
  const nearExpiryDate = input.nearExpiryDays
    ? new Date(now.getTime() + input.nearExpiryDays * 24 * 60 * 60 * 1000)
    : undefined;

  const where = {
    deletedAt: null,
    ...(input.q && {
      name: { contains: input.q, mode: 'insensitive' as const },
    }),
    ...(input.categoryId && { categoryId: input.categoryId }),
    ...(input.status && { status: input.status }),
    ...(input.stockState === 'OUT' && { currentStock: { lte: 0 } }),
    // HEALTHY stock state filtered client-side (same pattern as LOW) to avoid
    // cross-column FieldRef type mismatch after currentStock changed to Float.
    ...(input.stockState === 'HEALTHY' && { currentStock: { gt: 0 } }),
    ...(nearExpiryDate && { expiryDate: { lte: nearExpiryDate, gte: now } }),
  };

  // Stable order: primary sort + id tiebreaker, so cursor pagination is deterministic
  // even when the primary column has duplicates (e.g. expiryDate null on many rows).
  const orderBy = [
    { [input.sortBy ?? 'name']: input.sortDir ?? 'asc' } as Record<string, 'asc' | 'desc'>,
    { id: 'asc' as const },
  ];

  const items = await prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy,
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = items.length > input.limit;
  const data = (hasMore ? items.slice(0, -1) : items).map(withStockState);

  // Client-side filter for LOW/HEALTHY — avoids cross-column SQL comparisons
  const filtered =
    input.stockState === 'LOW' || input.stockState === 'HEALTHY'
      ? data.filter((i) => i.stockState === input.stockState)
      : data;

  return { data: filtered, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}

export async function findById(id: string) {
  const item = await prisma.item.findFirst({ where: { id, deletedAt: null }, include: itemInclude });
  if (!item) throw new ApiError('NOT_FOUND', 404, `Item ${id} not found`);
  return withStockState(item);
}

export async function create(input: CreateItemInput, actorId: string) {
  return prisma.item.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      unitOfMeasure: input.unitOfMeasure,
      categoryId: input.categoryId,
      currentStock: input.currentStock,
      reorderThreshold: input.reorderThreshold,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      status: input.status ?? ItemStatus.ACTIVE,
      createdById: actorId,
    },
    include: itemInclude,
  });
}

export async function update(id: string, input: UpdateItemInput) {
  await findById(id);
  return prisma.item.update({
    where: { id },
    data: {
      ...input,
      expiryDate: input.expiryDate !== undefined
        ? (input.expiryDate ? new Date(input.expiryDate) : null)
        : undefined,
    },
    include: itemInclude,
  });
}

export async function softDelete(id: string) {
  await findById(id);
  return prisma.item.update({ where: { id }, data: { deletedAt: new Date(), status: ItemStatus.DISCONTINUED } });
}
