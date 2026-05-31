import { z } from 'zod';

export const AUDIT_SORTABLE_COLUMNS = ['createdAt', 'action', 'targetType'] as const;
export type AuditSortColumn = (typeof AUDIT_SORTABLE_COLUMNS)[number];

export const ListAuditLogsDto = z.object({
  actorId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  sortBy: z.enum(AUDIT_SORTABLE_COLUMNS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type ListAuditLogsInput = z.infer<typeof ListAuditLogsDto>;
