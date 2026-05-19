import { AdjustmentReason, ItemStatus, RequestStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { env } from '@/env';
import type {
  ConsumptionReportInput,
  InventorySnapshotInput,
  MonthlyUsageInput,
  NearExpiryReportInput,
  RequestAnalyticsInput,
  RequestSummaryInput,
  StockMovementInput,
} from './dto';

// ─── CSV helper ──────────────────────────────────────────────────────────────

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

// ─── Report types ─────────────────────────────────────────────────────────────

export type InventorySnapshotRow = {
  name: string;
  category: string;
  unitOfMeasure: string;
  currentStock: number;
  reorderThreshold: number;
  stockState: 'HEALTHY' | 'LOW' | 'OUT';
  status: ItemStatus;
  expiryDate: Date | null;
};

export type LowStockRow = {
  name: string;
  category: string;
  currentStock: number;
  reorderThreshold: number;
  stockState: 'LOW' | 'OUT';
};

export type NearExpiryRow = {
  name: string;
  category: string;
  currentStock: number;
  expiryDate: Date;
};

export type ConsumptionRow = {
  date: string;
  reason: string;
  totalDelta: number;
  count: number;
};

export type RequestAnalyticsResult = {
  byStatus: { status: string; count: number }[];
  avgApprovalTimeHours: number | null;
  totalLines: number;
  fulfilmentRate: number;
};

// ─── Service functions ────────────────────────────────────────────────────────

export async function inventorySnapshot(
  input?: InventorySnapshotInput,
): Promise<InventorySnapshotRow[]> {
  const items = await prisma.item.findMany({
    where: {
      status: ItemStatus.ACTIVE,
      deletedAt: null,
      ...(input?.categoryId && { categoryId: input.categoryId }),
      ...(input?.q && {
        name: { contains: input.q, mode: 'insensitive' },
      }),
      ...((input?.from || input?.to) && {
        createdAt: {
          ...(input.from && { gte: new Date(input.from) }),
          ...(input.to && { lte: new Date(input.to) }),
        },
      }),
    },
    include: { category: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const rows = items.map((item) => {
    let stockState: 'HEALTHY' | 'LOW' | 'OUT';
    if (item.currentStock <= 0) {
      stockState = 'OUT';
    } else if (item.currentStock < item.reorderThreshold) {
      stockState = 'LOW';
    } else {
      stockState = 'HEALTHY';
    }
    return {
      name: item.name,
      category: item.category.name,
      unitOfMeasure: item.unitOfMeasure,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      stockState,
      status: item.status,
      expiryDate: item.expiryDate,
    };
  });

  // Optional client-side stockState filter (column-to-column comparison done above, but
  // stockState is derived so we filter after mapping)
  return input?.stockState ? rows.filter((r) => r.stockState === input.stockState) : rows;
}

export async function lowStockReport(): Promise<LowStockRow[]> {
  // Prisma doesn't support column-to-column comparisons, so fetch ACTIVE items and filter in JS
  const items = await prisma.item.findMany({
    where: {
      status: ItemStatus.ACTIVE,
      deletedAt: null,
    },
    include: { category: { select: { name: true } } },
    orderBy: { currentStock: 'asc' },
  });

  return items
    .filter((item) => item.currentStock <= item.reorderThreshold)
    .map((item) => ({
      name: item.name,
      category: item.category.name,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      stockState: item.currentStock <= 0 ? ('OUT' as const) : ('LOW' as const),
    }));
}

export async function nearExpiryReport(input?: NearExpiryReportInput | number): Promise<NearExpiryRow[]> {
  // Support both legacy numeric `days` arg and new structured input
  const opts: NearExpiryReportInput =
    typeof input === 'number'
      ? { days: input, format: 'json' }
      : input ?? { days: env.NEAR_EXPIRY_WINDOW_DAYS, format: 'json' };

  const now = new Date();
  let expiryFrom: Date;
  let expiryTo: Date;

  if (opts.from || opts.to) {
    // Explicit date range overrides `days`
    expiryFrom = opts.from ? new Date(opts.from) : now;
    expiryTo = opts.to ? new Date(opts.to) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  } else {
    expiryFrom = now;
    expiryTo = new Date(now.getTime() + (opts.days ?? env.NEAR_EXPIRY_WINDOW_DAYS) * 24 * 60 * 60 * 1000);
  }

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      expiryDate: { gte: expiryFrom, lte: expiryTo },
    },
    include: { category: { select: { name: true } } },
    orderBy: { expiryDate: 'asc' },
  });

  return items.map((item) => ({
    name: item.name,
    category: item.category.name,
    currentStock: item.currentStock,
    expiryDate: item.expiryDate!,
  }));
}

// ─── Consumption detail (individual rows for table view) ─────────────────────

export type ConsumptionDetailRow = {
  id: string;
  date: Date;
  itemName: string;
  actor: string;
  reason: string;
  delta: number;
  balanceAfter: number;
  note: string | null;
};

export async function consumptionDetail(input: ConsumptionReportInput): Promise<ConsumptionDetailRow[]> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      reason: { in: CONSUMPTION_REASONS },
      ...(input.itemId && { itemId: input.itemId }),
      ...((input.from || input.to) && {
        createdAt: {
          ...(input.from && { gte: new Date(input.from) }),
          ...(input.to && { lte: new Date(input.to) }),
        },
      }),
    },
    include: {
      item: { select: { name: true } },
      actor: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return adjustments.map((adj) => ({
    id: adj.id,
    date: adj.createdAt,
    itemName: adj.item.name,
    actor: adj.actor.name,
    reason: adj.reason,
    delta: adj.delta,
    balanceAfter: adj.balanceAfter,
    note: adj.note,
  }));
}

const CONSUMPTION_REASONS: AdjustmentReason[] = [
  AdjustmentReason.CONSUMPTION,
  AdjustmentReason.FULFILMENT,
  AdjustmentReason.DAMAGE,
  AdjustmentReason.EXPIRY,
];

export async function consumptionReport(input: ConsumptionReportInput): Promise<ConsumptionRow[]> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      reason: { in: CONSUMPTION_REASONS },
      ...(input.itemId && { itemId: input.itemId }),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from && { gte: new Date(input.from) }),
              ...(input.to && { lte: new Date(input.to) }),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date (YYYY-MM-DD) and reason
  const grouped = new Map<string, { totalDelta: number; count: number }>();

  for (const adj of adjustments) {
    const date = adj.createdAt.toISOString().slice(0, 10);
    const key = `${date}|${adj.reason}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalDelta += adj.delta;
      existing.count += 1;
    } else {
      grouped.set(key, { totalDelta: adj.delta, count: 1 });
    }
  }

  return Array.from(grouped.entries())
    .map(([key, val]) => {
      const [date, reason] = key.split('|');
      return { date: date!, reason: reason!, totalDelta: val.totalDelta, count: val.count };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function requestAnalytics(input: RequestAnalyticsInput): Promise<RequestAnalyticsResult> {
  const dateFilter =
    input.from || input.to
      ? {
          createdAt: {
            ...(input.from && { gte: new Date(input.from) }),
            ...(input.to && { lte: new Date(input.to) }),
          },
        }
      : {};

  // byStatus: groupBy status
  const statusGroups = await prisma.request.groupBy({
    by: ['status'],
    where: dateFilter,
    _count: { _all: true },
  });

  const byStatus = statusGroups.map((g) => ({
    status: g.status as string,
    count: g._count._all,
  }));

  // totalLines: count all request lines in scope
  const requestIds = await prisma.request.findMany({
    where: dateFilter,
    select: { id: true },
  });
  const ids = requestIds.map((r) => r.id);

  const totalLines = await prisma.requestLine.count({
    where: { requestId: { in: ids } },
  });

  // avgApprovalTimeHours: requests with approvedAt set
  const approvedRequests = await prisma.request.findMany({
    where: {
      ...dateFilter,
      approvedAt: { not: null },
    },
    select: { createdAt: true, approvedAt: true },
  });

  let avgApprovalTimeHours: number | null = null;
  if (approvedRequests.length > 0) {
    const totalMs = approvedRequests.reduce((sum, r) => {
      return sum + (r.approvedAt!.getTime() - r.createdAt.getTime());
    }, 0);
    avgApprovalTimeHours = totalMs / approvedRequests.length / (1000 * 60 * 60);
  }

  // fulfilmentRate: FULFILLED / (APPROVED + FULFILLED) * 100
  const approvedCount = statusGroups.find((g) => g.status === RequestStatus.APPROVED)?._count._all ?? 0;
  const fulfilledCount = statusGroups.find((g) => g.status === RequestStatus.FULFILLED)?._count._all ?? 0;
  const denominator = approvedCount + fulfilledCount;
  const fulfilmentRate = denominator > 0 ? (fulfilledCount / denominator) * 100 : 0;

  return {
    byStatus,
    avgApprovalTimeHours,
    totalLines,
    fulfilmentRate,
  };
}

// ─── Stock Movement Report ────────────────────────────────────────────────────

export type StockMovementRow = {
  id: string;
  date: Date;
  itemId: string;
  itemName: string;
  category: string;
  actor: string;
  reason: string;
  direction: 'IN' | 'OUT';
  qty: number;          // absolute value
  delta: number;        // signed original
  balanceAfter: number;
  note: string | null;
};

export type StockMovementSummary = {
  totalIn: number;      // sum of all positive deltas
  totalOut: number;     // sum of absolute negative deltas
  netMovement: number;  // totalIn - totalOut
  rowCount: number;
};

export async function stockMovementReport(
  input: StockMovementInput,
): Promise<{ rows: StockMovementRow[]; summary: StockMovementSummary }> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      // Direction filter
      ...(input.direction === 'IN'  && { delta: { gt: 0 } }),
      ...(input.direction === 'OUT' && { delta: { lt: 0 } }),
      // Date range
      ...((input.from || input.to) && {
        createdAt: {
          ...(input.from && { gte: new Date(input.from) }),
          ...(input.to   && { lte: new Date(input.to) }),
        },
      }),
      // Item filter
      ...(input.itemId && { itemId: input.itemId }),
      // Category or search filter — join via item
      ...((input.categoryId || input.q) && {
        item: {
          ...(input.categoryId && { categoryId: input.categoryId }),
          ...(input.q && {
            name: { contains: input.q, mode: 'insensitive' },
          }),
        },
      }),
    },
    include: {
      item:  { select: { id: true, name: true, category: { select: { name: true } } } },
      actor: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const rows: StockMovementRow[] = adjustments.map((adj) => ({
    id:           adj.id,
    date:         adj.createdAt,
    itemId:       adj.item.id,
    itemName:     adj.item.name,
    category:     adj.item.category.name,
    actor:        adj.actor.name,
    reason:       adj.reason,
    direction:    adj.delta >= 0 ? 'IN' : 'OUT',
    qty:          Math.abs(adj.delta),
    delta:        adj.delta,
    balanceAfter: adj.balanceAfter,
    note:         adj.note,
  }));

  const summary: StockMovementSummary = rows.reduce(
    (acc, r) => {
      if (r.direction === 'IN') {
        acc.totalIn += r.qty;
      } else {
        acc.totalOut += r.qty;
      }
      acc.netMovement = acc.totalIn - acc.totalOut;
      acc.rowCount += 1;
      return acc;
    },
    { totalIn: 0, totalOut: 0, netMovement: 0, rowCount: 0 },
  );

  return { rows, summary };
}

// ─── Monthly Usage Report ─────────────────────────────────────────────────────

/** Outbound reasons that represent real consumption / removal. */
const USAGE_REASONS: AdjustmentReason[] = [
  AdjustmentReason.CONSUMPTION,
  AdjustmentReason.FULFILMENT,
  AdjustmentReason.DAMAGE,
  AdjustmentReason.EXPIRY,
];

export type MonthlyUsageRow = {
  /** YYYY-MM */
  month: string;
  itemId: string;
  itemName: string;
  category: string;
  unitsConsumed: number;   // sum of |delta| for that item × month
  transactions: number;    // count of adjustment rows
  avgPerTransaction: number;
};

export type MonthlyUsageSummary = {
  totalUnitsConsumed: number;
  totalTransactions: number;
  /** Top-5 items by total consumption, descending */
  topItems: { itemName: string; unitsConsumed: number }[];
  /** Month label with the highest consumption */
  peakMonth: string | null;
};

export async function monthlyUsageReport(
  input: MonthlyUsageInput,
): Promise<{ rows: MonthlyUsageRow[]; summary: MonthlyUsageSummary }> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      reason: { in: USAGE_REASONS },
      delta:  { lt: 0 },   // outbound only
      ...((input.from || input.to) && {
        createdAt: {
          ...(input.from && { gte: new Date(input.from) }),
          ...(input.to   && { lte: new Date(input.to) }),
        },
      }),
      ...((input.categoryId || input.q) && {
        item: {
          ...(input.categoryId && { categoryId: input.categoryId }),
          ...(input.q && {
            name: { contains: input.q, mode: 'insensitive' },
          }),
        },
      }),
    },
    include: {
      item: {
        select: {
          id: true, name: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month + itemId
  type Key = string; // "YYYY-MM|itemId"
  const grouped = new Map<Key, { qty: number; count: number; item: typeof adjustments[0]['item'] }>();

  for (const adj of adjustments) {
    const month = adj.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    const key = `${month}|${adj.item.id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.qty   += Math.abs(adj.delta);
      existing.count += 1;
    } else {
      grouped.set(key, { qty: Math.abs(adj.delta), count: 1, item: adj.item });
    }
  }

  const rows: MonthlyUsageRow[] = Array.from(grouped.entries())
    .map(([key, val]) => {
      const [month] = key.split('|');
      return {
        month:             month!,
        itemId:            val.item.id,
        itemName:          val.item.name,
        category:          val.item.category.name,
        unitsConsumed:     val.qty,
        transactions:      val.count,
        avgPerTransaction: Math.round((val.qty / val.count) * 10) / 10,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month) || b.unitsConsumed - a.unitsConsumed);

  // Summary: aggregate per item for top-items list
  const byItem = new Map<string, { itemName: string; total: number }>();
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const item = byItem.get(r.itemId);
    if (item) { item.total += r.unitsConsumed; }
    else       { byItem.set(r.itemId, { itemName: r.itemName, total: r.unitsConsumed }); }
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.unitsConsumed);
  }

  const topItems = Array.from(byItem.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((v) => ({ itemName: v.itemName, unitsConsumed: v.total }));

  let peakMonth: string | null = null;
  let peakQty = 0;
  for (const [month, qty] of byMonth.entries()) {
    if (qty > peakQty) { peakQty = qty; peakMonth = month; }
  }

  const totalUnitsConsumed = Array.from(byItem.values()).reduce((s, v) => s + v.total, 0);
  const totalTransactions  = rows.reduce((s, r) => s + r.transactions, 0);

  return {
    rows,
    summary: { totalUnitsConsumed, totalTransactions, topItems, peakMonth },
  };
}

// ─── Request Summary Report ───────────────────────────────────────────────────

export type RequestSummaryRow = {
  id: string;
  createdAt: Date;
  requester: string;
  status: string;
  reason: string;
  lineCount: number;
  totalRequestedQty: number;
  totalApprovedQty:  number;
  totalFulfilledQty: number;
  approver: string | null;
  approvedAt: Date | null;
};

export type RequestSummarySummary = {
  total: number;
  byStatus: { status: string; count: number }[];
  totalRequestedQty:  number;
  totalApprovedQty:   number;
  totalFulfilledQty:  number;
};

export async function requestSummaryReport(
  input: RequestSummaryInput,
): Promise<{ rows: RequestSummaryRow[]; summary: RequestSummarySummary }> {
  const requests = await prisma.request.findMany({
    where: {
      ...(input.status && { status: input.status as RequestStatus }),
      ...((input.from || input.to) && {
        createdAt: {
          ...(input.from && { gte: new Date(input.from) }),
          ...(input.to   && { lte: new Date(input.to) }),
        },
      }),
      ...(input.q && {
        requester: { name: { contains: input.q, mode: 'insensitive' } },
      }),
    },
    include: {
      requester: { select: { name: true } },
      approver:  { select: { name: true } },
      lines:     { select: { requestedQty: true, approvedQty: true, fulfilledQty: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const rows: RequestSummaryRow[] = requests.map((req) => ({
    id:                req.id,
    createdAt:         req.createdAt,
    requester:         req.requester.name,
    status:            req.status,
    reason:            req.reason,
    lineCount:         req.lines.length,
    totalRequestedQty: req.lines.reduce((s, l) => s + l.requestedQty, 0),
    totalApprovedQty:  req.lines.reduce((s, l) => s + (l.approvedQty ?? 0), 0),
    totalFulfilledQty: req.lines.reduce((s, l) => s + l.fulfilledQty, 0),
    approver:          req.approver?.name ?? null,
    approvedAt:        req.approvedAt,
  }));

  // Summary aggregates
  const statusMap = new Map<string, number>();
  let totalRequestedQty  = 0;
  let totalApprovedQty   = 0;
  let totalFulfilledQty  = 0;

  for (const r of rows) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
    totalRequestedQty  += r.totalRequestedQty;
    totalApprovedQty   += r.totalApprovedQty;
    totalFulfilledQty  += r.totalFulfilledQty;
  }

  const STATUS_ORDER = ['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'];
  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  return {
    rows,
    summary: { total: rows.length, byStatus, totalRequestedQty, totalApprovedQty, totalFulfilledQty },
  };
}
