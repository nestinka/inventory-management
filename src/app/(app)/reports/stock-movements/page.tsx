import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { stockMovementReport } from '@/server/modules/reports';
import { prisma } from '@/server/db/client';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { SortableHeader } from '@/components/ui/sortable-header';
import { resolveSort, resolveSortDir, sortRows, type SortGetter } from '@/lib/sort';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Stock Movement Report' };
export const dynamic = 'force-dynamic';

const MOVEMENT_SORT_COLUMNS = ['date', 'itemName', 'category', 'actor', 'reason', 'qty', 'balanceAfter'] as const;
type MovementSortColumn = (typeof MOVEMENT_SORT_COLUMNS)[number];

type MovementRow = {
  id: string; date: Date | string; itemName: string; category: string;
  actor: string; reason: string; qty: number; balanceAfter: number;
  direction: 'IN' | 'OUT'; note?: string | null;
};

const movementGetters: Record<MovementSortColumn, SortGetter<MovementRow>> = {
  date: (r) => new Date(r.date),
  itemName: (r) => r.itemName,
  category: (r) => r.category,
  actor: (r) => r.actor,
  reason: (r) => r.reason,
  // Signed quantity so "Qty desc" surfaces the biggest additions first, "asc" surfaces biggest removals.
  qty: (r) => (r.direction === 'IN' ? 1 : -1) * r.qty,
  balanceAfter: (r) => r.balanceAfter,
};

const REASON_BADGE: Record<string, string> = {
  RECEIVED:         'bg-emerald-100 text-emerald-800',
  CONSUMPTION:      'bg-blue-100    text-blue-800',
  FULFILMENT:       'bg-purple-100  text-purple-800',
  DAMAGE:           'bg-red-100     text-red-800',
  EXPIRY:           'bg-orange-100  text-orange-800',
  AUDIT_CORRECTION: 'bg-gray-100    text-gray-700',
  MANUAL_OVERRIDE:  'bg-gray-100    text-gray-700',
};

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const direction = (sp.direction as 'ALL' | 'IN' | 'OUT') || 'ALL';

  const [{ rows: rawRows, summary }, categories] = await Promise.all([
    stockMovementReport({
      from:       sp.from       || undefined,
      to:         sp.to         || undefined,
      direction,
      itemId:     sp.itemId     || undefined,
      categoryId: sp.categoryId || undefined,
      q:          sp.q          || undefined,
      format:     'json',
    }),
    prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const sortBy = resolveSort(sp.sortBy, MOVEMENT_SORT_COLUMNS, 'date');
  const sortDir = resolveSortDir(sp.sortDir, 'desc');
  const rows = sortRows(rawRows, movementGetters[sortBy], sortDir);

  const netPositive = summary.netMovement >= 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/reports"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to reports"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stock Movement Report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All stock additions and removals within the selected date range
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <ReportDateFilter
          extraFilters={[
            {
              key: 'direction',
              label: 'Direction',
              type: 'select',
              options: [
                { value: 'IN',  label: '↑ Additions only' },
                { value: 'OUT', label: '↓ Removals only'  },
              ],
            },
            {
              key: 'categoryId',
              label: 'Category',
              type: 'select',
              options: categories.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              key: 'q',
              label: 'Search item',
              type: 'text',
              placeholder: 'Name…',
            },
          ]}
        />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalIn.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total added</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <TrendingDown className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalOut.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total removed</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              netPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <p className={`text-xl font-bold ${netPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {summary.netMovement >= 0 ? '+' : ''}{summary.netMovement.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Net movement</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-sm font-bold">#</span>
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.rowCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="date" label="Date / Time" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="itemName" label="Item" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="category" label="Category" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
                <SortableHeader column="actor" label="Actor" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
                <SortableHeader column="reason" label="Reason" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="qty" label="Qty" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="balanceAfter" label="Balance" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="hidden sm:table-cell !text-right" />
                <th className="hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.itemName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {row.category}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {row.actor}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        REASON_BADGE[row.reason] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {row.reason.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={`font-semibold ${
                        row.direction === 'IN' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {row.direction === 'IN' ? '+' : '−'}{row.qty}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.balanceAfter}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {row.note ?? '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    No stock movements found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length === 1000 && (
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
            Showing first 1,000 records — narrow the date range to see more specific results.
          </div>
        )}
      </div>
    </div>
  );
}
