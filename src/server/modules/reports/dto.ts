import { z } from 'zod';

export const ReportFormatDto = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

export const InventorySnapshotDto = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  stockState: z.enum(['HEALTHY', 'LOW', 'OUT']).optional(),
  from: z.string().datetime().optional(), // item createdAt >=
  to: z.string().datetime().optional(),   // item createdAt <=
  format: z.enum(['json', 'csv']).default('json'),
});

export const NearExpiryReportDto = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  from: z.string().datetime().optional(), // expiry date >=
  to: z.string().datetime().optional(),   // expiry date <=
  format: z.enum(['json', 'csv']).default('json'),
});

export const ConsumptionReportDto = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  itemId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const RequestAnalyticsDto = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const StockMovementDto = z.object({
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  direction:  z.enum(['ALL', 'IN', 'OUT']).default('ALL'),
  itemId:     z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  q:          z.string().optional(),
  format:     z.enum(['json', 'csv']).default('json'),
});

export const MonthlyUsageDto = z.object({
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  categoryId: z.string().uuid().optional(),
  q:          z.string().optional(),   // search item name
  format:     z.enum(['json', 'csv']).default('json'),
});

export const RequestSummaryDto = z.object({
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED']).optional(),
  q:      z.string().optional(),       // search requester name
  format: z.enum(['json', 'csv']).default('json'),
});

export type ReportFormatInput      = z.infer<typeof ReportFormatDto>;
export type InventorySnapshotInput = z.infer<typeof InventorySnapshotDto>;
export type NearExpiryReportInput  = z.infer<typeof NearExpiryReportDto>;
export type ConsumptionReportInput = z.infer<typeof ConsumptionReportDto>;
export type RequestAnalyticsInput  = z.infer<typeof RequestAnalyticsDto>;
export type StockMovementInput     = z.infer<typeof StockMovementDto>;
export type MonthlyUsageInput      = z.infer<typeof MonthlyUsageDto>;
export type RequestSummaryInput    = z.infer<typeof RequestSummaryDto>;
