import { z } from 'zod';
import { RequestStatus } from '@prisma/client';

export const NewRequestItemDto = z.object({
  name: z.string().min(1).max(200).trim(),
  unitOfMeasure: z.string().min(1).max(20).trim(),
  categoryId: z.string().uuid(),
});

export const CreateRequestDto = z.object({
  reason: z.string().min(1).max(500).trim(),
  lines: z
    .array(
      z
        .object({
          // An existing catalogue item …
          itemId: z.string().uuid().optional(),
          // … or a proposed item not yet in the catalogue (created on approval).
          newItem: NewRequestItemDto.optional(),
          requestedQty: z.number().int().min(1),
        })
        .refine((l) => (l.itemId == null) !== (l.newItem == null), {
          message: 'Each line must reference either an existing itemId or a newItem (not both)',
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

export const REQUEST_SORTABLE_COLUMNS = [
  'createdAt', 'status', 'approvedAt', 'fulfilledAt',
] as const;
export type RequestSortColumn = (typeof REQUEST_SORTABLE_COLUMNS)[number];

export const ListRequestsDto = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  requesterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.enum(REQUEST_SORTABLE_COLUMNS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type CreateRequestInput = z.infer<typeof CreateRequestDto>;
export type ApproveRequestInput = z.infer<typeof ApproveRequestDto>;
export type RejectRequestInput = z.infer<typeof RejectRequestDto>;
export type FulfilRequestInput = z.infer<typeof FulfilRequestDto>;
export type ListRequestsInput = z.infer<typeof ListRequestsDto>;
