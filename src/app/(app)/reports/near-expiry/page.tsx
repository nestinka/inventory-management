import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { nearExpiryReport } from '@/server/modules/reports';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { SortableHeader } from '@/components/ui/sortable-header';
import { resolveSort, resolveSortDir, sortRows, type SortGetter } from '@/lib/sort';
import { formatDate } from '@/lib/utils';
import { env } from '@/env';

export const metadata: Metadata = { title: 'Near Expiry Report' };
export const dynamic = 'force-dynamic';

const NEAR_EXPIRY_SORT_COLUMNS = ['name', 'category', 'currentStock', 'expiryDate'] as const;
type NearExpirySortColumn = (typeof NEAR_EXPIRY_SORT_COLUMNS)[number];

type NearExpiryRow = { name: string; category: string; currentStock: number; expiryDate: Date };

const nearExpiryGetters: Record<NearExpirySortColumn, SortGetter<NearExpiryRow>> = {
  name: (r) => r.name,
  category: (r) => r.category,
  currentStock: (r) => r.currentStock,
  expiryDate: (r) => new Date(r.expiryDate),
};

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function expiryUrgencyCls(days: number): string {
  if (days <= 7)  return 'bg-red-100 text-red-800';
  if (days <= 14) return 'bg-orange-100 text-orange-800';
  return 'bg-amber-100 text-amber-800';
}

export default async function NearExpiryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const raw = await nearExpiryReport({
    days: sp.days ? Number(sp.days) : env.NEAR_EXPIRY_WINDOW_DAYS,
    from: sp.from || undefined,
    to:   sp.to   || undefined,
    format: 'json',
  });

  const sortBy = resolveSort(sp.sortBy, NEAR_EXPIRY_SORT_COLUMNS, 'expiryDate');
  const sortDir = resolveSortDir(sp.sortDir, 'asc');
  const data = sortRows(raw, nearExpiryGetters[sortBy], sortDir);

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
          <h1 className="text-2xl font-semibold text-foreground">Near Expiry</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.length} item{data.length !== 1 ? 's' : ''} expiring soon
          </p>
        </div>
      </div>

      <Suspense>
        <ReportDateFilter
          extraFilters={[
            {
              key: 'days',
              label: 'Within (days)',
              type: 'number',
              placeholder: String(env.NEAR_EXPIRY_WINDOW_DAYS),
              min: 1,
              max: 365,
            },
          ]}
        />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="name" label="Name" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="category" label="Category" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="currentStock" label="Stock" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="expiryDate" label="Expiry Date" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <th>Days Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => {
                const days = daysUntil(row.expiryDate);
                return (
                  <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {row.currentStock}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatDate(row.expiryDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${expiryUrgencyCls(days)}`}
                      >
                        {days <= 0 ? 'Expired' : `${days}d`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No items expiring within the selected range.
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
