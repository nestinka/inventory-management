import { z } from 'zod';
import { ItemStatus } from '@prisma/client';

export const CreateItemDto = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  unitOfMeasure: z.string().min(1).max(50).trim(),
  categoryId: z.string().uuid(),
  currentStock: z.number().int().min(0).default(0),
  reorderThreshold: z.number().int().min(0).default(0),
  expiryDate: z.string().date().or(z.literal('').transform(() => null as null)).optional().nullable(),
  status: z.nativeEnum(ItemStatus).default(ItemStatus.ACTIVE),
});

// Explicit partial — NO .default() on numeric fields so a PUT that omits
// currentStock / reorderThreshold never silently writes 0 to the DB.
export const UpdateItemDto = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional().nullable(),
  unitOfMeasure: z.string().min(1).max(50).trim().optional(),
  categoryId: z.string().uuid().optional(),
  currentStock: z.number().int().min(0).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
  expiryDate: z.string().date().or(z.literal('').transform(() => null as null)).optional().nullable(),
  status: z.nativeEnum(ItemStatus).optional(),
});

export const ListItemsDto = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ItemStatus).optional(),
  stockState: z.enum(['HEALTHY', 'LOW', 'OUT']).optional(),
  nearExpiryDays: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  sort: z.string().optional(),
});

export type CreateItemInput = z.infer<typeof CreateItemDto>;
export type UpdateItemInput = z.infer<typeof UpdateItemDto>;
export type ListItemsInput = z.infer<typeof ListItemsDto>;
