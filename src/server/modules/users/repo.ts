import { prisma } from '@/server/db/client';
import { ApiError } from '@/server/lib/errors';
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from './dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export async function findMany(input: ListUsersInput) {
  const where = {
    deletedAt: null,
    ...(input.q && {
      OR: [
        { name: { contains: input.q, mode: 'insensitive' as const } },
        { email: { contains: input.q, mode: 'insensitive' as const } },
      ],
    }),
    ...(input.role !== undefined && { role: input.role }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };

  // Postgres sorts NULLs last for asc and first for desc by default; that's the
  // intuitive behaviour for lastLoginAt (never-logged-in users sink to the end).
  const orderBy = [
    { [input.sortBy ?? 'name']: input.sortDir ?? 'asc' } as Record<string, 'asc' | 'desc'>,
    { id: 'asc' as const },
  ];

  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy,
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = users.length > input.limit;
  const data = hasMore ? users.slice(0, -1) : users;
  return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null };
}

export async function findById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });
  if (!user) throw new ApiError('NOT_FOUND', 404, `User ${id} not found`);
  return user;
}

export async function create(input: CreateUserInput, passwordHash: string) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash,
    },
    select: USER_SELECT,
  });
}

export async function update(id: string, input: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: USER_SELECT,
  });
}

export async function softDelete(id: string) {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: USER_SELECT,
  });
}
