import { z } from 'zod';
import { CategoryStatus } from '@prisma/client';

export const CreateCategoryDto = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export const UpdateCategoryDto = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  status: z.nativeEnum(CategoryStatus).optional(),
});

export const ListCategoriesDto = z.object({
  q: z.string().optional(),
  status: z.nativeEnum(CategoryStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategoryDto>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryDto>;
export type ListCategoriesInput = z.infer<typeof ListCategoriesDto>;
