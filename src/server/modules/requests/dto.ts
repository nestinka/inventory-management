import { z } from 'zod';
import { RequestStatus } from '@prisma/client';

export const CreateRequestDto = z.object({
  reason: z.string().min(1).max(500).trim(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        requestedQty: z.number().int().min(1),
      }),
    )
    .min(1),
});

export const ApproveRequestDto = z.object({
  lines: z.array(
    z.object({
      lineId: z.string().uuid(),
      approvedQty: z.number().int().min(0),
    }),
  ),
  note: z.string().max(500).optional(),
});

export const RejectRequestDto = z.object({
  note: z.string().min(1).max(500),
});

export const FulfilRequestDto = z.object({
  lines: z.array(
    z.object({
      lineId: z.string().uuid(),
      fulfilledQty: z.number().int().min(0),
    }),
  ),
});

export const ListRequestsDto = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  requesterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof CreateRequestDto>;
export type ApproveRequestInput = z.infer<typeof ApproveRequestDto>;
export type RejectRequestInput = z.infer<typeof RejectRequestDto>;
export type FulfilRequestInput = z.infer<typeof FulfilRequestDto>;
export type ListRequestsInput = z.infer<typeof ListRequestsDto>;
