import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { consumptionDetail } from '@/server/modules/reports';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Consumption Trends' };
export const dynamic = 'force-dynamic';

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

  const data = await consumptionDetail({
    from:   sp.from   || undefined,
    to:     sp.to     || undefined,
    itemId: sp.itemId || undefined,
    format: 'json',
  });

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
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Actor</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Balance</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Note</th>
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
