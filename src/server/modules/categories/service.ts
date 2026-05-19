import { prisma } from '@/server/db/client';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import * as repo from './repo';
import type { CreateCategoryInput, UpdateCategoryInput } from './dto';

export const listCategories = repo.findMany;
export const getCategory = repo.findById;

export async function createCategory(input: CreateCategoryInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' }, status: 'ACTIVE' },
    });
    if (existing) throw new ApiError('VALIDATION_FAILED', 409, `Category '${input.name}' already exists`);

    const category = await tx.category.create({
      data: { name: input.name, description: input.description ?? null },
    });

    await writeAudit(tx, {
      actorId: actor.id, action: 'category.create', targetType: 'category',
      targetId: category.id, diff: { after: category }, ctx,
    });

    return category;
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findFirst({ where: { id } });
    if (!before) throw new ApiError('NOT_FOUND', 404, `Category ${id} not found`);

    const after = await tx.category.update({ where: { id }, data: input });

    await writeAudit(tx, {
      actorId: actor.id, action: 'category.update', targetType: 'category',
      targetId: id, diff: { before, after }, ctx,
    });

    return after;
  });
}

export async function deactivateCategory(id: string, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findFirst({ where: { id } });
    if (!before) throw new ApiError('NOT_FOUND', 404, `Category ${id} not found`);

    const inUse = await tx.item.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse > 0) throw new ApiError('VALIDATION_FAILED', 409, 'Cannot deactivate a category that has active items');

    const after = await tx.category.update({ where: { id }, data: { status: 'INACTIVE' } });

    await writeAudit(tx, {
      actorId: actor.id, action: 'category.deactivate', targetType: 'category',
      targetId: id, diff: { before: { status: before.status }, after: { status: 'INACTIVE' } }, ctx,
    });

    return after;
  });
}

export async function activateCategory(id: string, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.category.findFirst({ where: { id } });
    if (!before) throw new ApiError('NOT_FOUND', 404, `Category ${id} not found`);

    const after = await tx.category.update({ where: { id }, data: { status: 'ACTIVE' } });

    await writeAudit(tx, {
      actorId: actor.id, action: 'category.activate', targetType: 'category',
      targetId: id, diff: { before: { status: before.status }, after: { status: 'ACTIVE' } }, ctx,
    });

    return after;
  });
}
