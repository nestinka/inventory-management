import { z } from 'zod';
import { UserRole } from '@prisma/client';

const userRoleEnum = z.nativeEnum(UserRole);

export const CreateUserDto = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
  role: userRoleEnum,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

export const UpdateUserDto = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  role: userRoleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const ListUsersDto = z.object({
  q: z.string().optional(),
  role: userRoleEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
export type UpdateUserInput = z.infer<typeof UpdateUserDto>;
export type ListUsersInput = z.infer<typeof ListUsersDto>;
