import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { consumptionDetail } from '@/server/modules/reports';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { SortableHeader } from '@/components/ui/sortable-header';
import { resolveSort, resolveSortDir, sortRows, type SortGetter } from '@/lib/sort';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Consumption Trends' };
export const dynamic = 'force-dynamic';

const CONSUMPTION_SORT_COLUMNS = ['date', 'itemName', 'actor', 'reason', 'delta', 'balanceAfter'] as const;
type ConsumptionSortColumn = (typeof CONSUMPTION_SORT_COLUMNS)[number];

type ConsumptionRow = {
  id: string; date: Date | string; itemName: string; actor: string; reason: string;
  delta: number; balanceAfter: number; note?: string | null;
};

const consumptionGetters: Record<ConsumptionSortColumn, SortGetter<ConsumptionRow>> = {
  date: (r) => new Date(r.date),
  itemName: (r) => r.itemName,
  actor: (r) => r.actor,
  reason: (r) => r.reason,
  delta: (r) => r.delta,
  balanceAfter: (r) => r.balanceAfter,
};

const REASON_STYLES: Record<string, string> = {
  CONSUMPTION:      'bg-blue-100   text-blue-800',
  FULFILMENT:       'bg-purple-100 text-purple-800',
  DAMAGE:           'bg-red-100    text-red-800',
  EXPIRY:           'bg-orange-100 text-orange-800',
  RECEIVED:         'bg-green-100  text-green-800',
  AUDIT_CORRECTION: 'bg-gray-100   text-gray-700',
  MANUAL_OVERRIDE:  'bg-gray-100   text-gray-700',
};

export default async function ConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const raw = await consumptionDetail({
    from:   sp.from   || undefined,
    to:     sp.to     || undefined,
    itemId: sp.itemId || undefined,
    format: 'json',
  });

  const sortBy = resolveSort(sp.sortBy, CONSUMPTION_SORT_COLUMNS, 'date');
  const sortDir = resolveSortDir(sp.sortDir, 'desc');
  const data = sortRows(raw, consumptionGetters[sortBy], sortDir);

  const totalConsumed = data.reduce(
    (sum, r) => sum + (r.delta < 0 ? Math.abs(r.delta) : 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/reports"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to reports"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Consumption Trends</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.length} adjustment{data.length !== 1 ? 's' : ''} · {totalConsumed} units consumed
          </p>
        </div>
      </div>

      <Suspense>
        <ReportDateFilter />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="date" label="Date" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="itemName" label="Item" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="actor" label="Actor" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
                <SortableHeader column="reason" label="Reason" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="delta" label="Qty" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="balanceAfter" label="Balance" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="hidden sm:table-cell !text-right" />
                <th className="hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.itemName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {row.actor}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${REASON_STYLES[row.reason] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {row.reason.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      row.delta < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {row.delta > 0 ? `+${row.delta}` : row.delta}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.balanceAfter}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {row.note ?? '—'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No adjustments found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
