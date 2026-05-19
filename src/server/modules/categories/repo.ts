import { prisma } from '@/server/db/client';
import { ApiError } from '@/server/lib/errors';
import type { CreateCategoryInput, UpdateCategoryInput, ListCategoriesInput } from './dto';

export async function findMany(input: ListCategoriesInput) {
  const where = {
    // Default to ACTIVE only; pass status explicitly to see INACTIVE
    status: input.status ?? 'ACTIVE',
    ...(input.q && { name: { contains: input.q, mode: 'insensitive' as const } }),
  };

  const items = await prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = items.length > input.limit;
  const data = hasMore ? items.slice(0, -1) : items;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}

export async function findById(id: string) {
  const cat = await prisma.category.findFirst({ where: { id } });
  if (!cat) throw new ApiError('NOT_FOUND', 404, `Category ${id} not found`);
  return cat;
}

export async function create(input: CreateCategoryInput) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: input.name, mode: 'insensitive' }, status: 'ACTIVE' },
  });
  if (existing) throw new ApiError('VALIDATION_FAILED', 409, `Category '${input.name}' already exists`);
  return prisma.category.create({ data: { name: input.name, description: input.description ?? null } });
}

export async function update(id: string, input: UpdateCategoryInput) {
  await findById(id);
  return prisma.category.update({ where: { id }, data: input });
}

export async function setStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  await findById(id);
  if (status === 'INACTIVE') {
    const inUse = await prisma.item.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse > 0) throw new ApiError('VALIDATION_FAILED', 409, 'Cannot deactivate a category that has active items');
  }
  return prisma.category.update({ where: { id }, data: { status } });
}
