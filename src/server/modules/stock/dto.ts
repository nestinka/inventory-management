import { z } from 'zod';
import { AdjustmentReason } from '@prisma/client';

export const AdjustStockDto = z.object({
  itemId: z.string().uuid(),
  delta: z.number().refine((v) => Math.abs(v) >= 0.5, { message: 'delta must be at least ±0.5' }),
  reason: z.nativeEnum(AdjustmentReason),
  note: z.string().max(500).optional(),
});

export const ListAdjustmentsDto = z.object({
  itemId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type AdjustStockInput = z.infer<typeof AdjustStockDto>;
export type ListAdjustmentsInput = z.infer<typeof ListAdjustmentsDto>;
