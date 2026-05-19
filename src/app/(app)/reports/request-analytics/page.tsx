import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requestAnalytics } from '@/server/modules/reports';
import { ReportDateFilter } from '@/components/reports/report-date-filter';

export const metadata: Metadata = { title: 'Request Analytics' };
export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-800',
  APPROVED:  'bg-blue-100  text-blue-800',
  FULFILLED: 'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100   text-red-800',
  CANCELLED: 'bg-gray-100  text-gray-600',
};

function statusBadgeCls(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
}

export default async function RequestAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const data = await requestAnalytics({
    from:   sp.from || undefined,
    to:     sp.to   || undefined,
    format: 'json',
  });

  const totalRequests = data.byStatus.reduce((sum, s) => sum + s.count, 0);

  const avgApprovalDisplay =
    data.avgApprovalTimeHours != null
      ? `${data.avgApprovalTimeHours.toFixed(1)} hrs`
      : '—';

  const fulfilmentDisplay =
    data.fulfilmentRate > 0
      ? `${data.fulfilmentRate.toFixed(1)}%`
      : '—';

  const kpiCards = [
    { label: 'Total Requests',   value: totalRequests.toLocaleString() },
    { label: 'Avg Approval Time', value: avgApprovalDisplay },
    { label: 'Total Line Items',  value: data.totalLines.toLocaleString() },
    { label: 'Fulfilment Rate',   value: fulfilmentDisplay },
  ];

  // Sort statuses in a logical order; unknown statuses go at the end
  const STATUS_ORDER = ['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'];
  const sortedStatuses = [...data.byStatus].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href="/reports"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to reports"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Request Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Approval rates, times, and volumes</p>
        </div>
      </div>

      <Suspense>
        <ReportDateFilter />
      </Suspense>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Status Breakdown</h2>
        </div>
        {sortedStatuses.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No request data available</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Count</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedStatuses.map((row, idx) => {
                const pct = totalRequests > 0
                  ? ((row.count / totalRequests) * 100).toFixed(1)
                  : '0.0';
                return (
                  <tr
                    key={row.status}
                    className={idx < sortedStatuses.length - 1 ? 'border-b border-border' : ''}
                  >
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeCls(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
