import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/client';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import { requireRole } from '@/server/auth/rbac';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import * as repo from './repo';
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from './dto';

export async function listUsers(input: ListUsersInput, actor: Actor) {
  requireRole('ADMIN', actor);
  return repo.findMany(input);
}

export async function getUser(id: string, actor: Actor) {
  requireRole('ADMIN', actor);
  return repo.findById(id);
}

export async function createUser(input: CreateUserInput, actor: Actor, ctx?: AuditContext) {
  requireRole('ADMIN', actor);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' }, deletedAt: null },
  });
  if (existing) throw new ApiError('VALIDATION_FAILED', 409, 'Email already in use');

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      diff: { after: { id: user.id, email: user.email, name: user.name, role: user.role } },
      ctx,
    });

    return user;
  });
}

export async function updateUser(id: string, input: UpdateUserInput, actor: Actor, ctx?: AuditContext) {
  requireRole('ADMIN', actor);

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ApiError('NOT_FOUND', 404, `User ${id} not found`);

    const after = await tx.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      diff: {
        before: { name: before.name, role: before.role, isActive: before.isActive },
        after: { name: after.name, role: after.role, isActive: after.isActive },
      },
      ctx,
    });

    return after;
  });
}

export async function deleteUser(id: string, actor: Actor, ctx?: AuditContext) {
  requireRole('ADMIN', actor);

  if (actor.id === id) {
    throw new ApiError('FORBIDDEN', 403, 'Cannot delete your own account');
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new ApiError('NOT_FOUND', 404, `User ${id} not found`);

    const after = await tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    await writeAudit(tx, {
      actorId: actor.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      diff: { before: { email: before.email, name: before.name, role: before.role } },
      ctx,
    });

    return after;
  });
}
