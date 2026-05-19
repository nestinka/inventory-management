import { prisma } from '@/server/db/client';
import { writeAudit } from '@/server/lib/audit';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import * as repo from './repo';
import type { CreateCategoryInput, UpdateCategoryInput } from './dto';

export const listCategories = repo.findMany;
export const getCategory = repo.findById;

export async function createCategory(input: CreateCategoryInput, actor: Actor, ctx?: AuditContext) {
  const category = await repo.create(input);
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: actor.id, action: 'category.create', targetType: 'category',
      targetId: category.id, diff: { after: category }, ctx,
    });
  });
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  const after = await repo.update(id, input);
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: actor.id, action: 'category.update', targetType: 'category',
      targetId: id, diff: { before, after }, ctx,
    });
  });
  return after;
}

export async function deactivateCategory(id: string, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  const after = await repo.setStatus(id, 'INACTIVE');
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: actor.id, action: 'category.deactivate', targetType: 'category',
      targetId: id, diff: { before: { status: before.status }, after: { status: 'INACTIVE' } }, ctx,
    });
  });
  return after;
}

export async function activateCategory(id: string, actor: Actor, ctx?: AuditContext) {
  const before = await repo.findById(id);
  const after = await repo.setStatus(id, 'ACTIVE');
  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: actor.id, action: 'category.activate', targetType: 'category',
      targetId: id, diff: { before: { status: before.status }, after: { status: 'ACTIVE' } }, ctx,
    });
  });
  return after;
}
