import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { requestSummaryReport } from '@/server/modules/reports';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { SortableHeader } from '@/components/ui/sortable-header';
import { resolveSort, resolveSortDir, sortRows, type SortGetter } from '@/lib/sort';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Request Summary Report' };
export const dynamic = 'force-dynamic';

const REQUEST_SUMMARY_SORT_COLUMNS = [
  'createdAt', 'requester', 'status', 'lineCount', 'totalRequestedQty',
  'totalApprovedQty', 'totalFulfilledQty', 'approver', 'approvedAt',
] as const;
type RequestSummarySortColumn = (typeof REQUEST_SUMMARY_SORT_COLUMNS)[number];

type RequestSummaryRow = {
  id: string; createdAt: Date | string; requester: string; status: string; reason: string;
  lineCount: number; totalRequestedQty: number; totalApprovedQty: number; totalFulfilledQty: number;
  approver: string | null; approvedAt: Date | string | null;
};

const requestSummaryGetters: Record<RequestSummarySortColumn, SortGetter<RequestSummaryRow>> = {
  createdAt: (r) => new Date(r.createdAt),
  requester: (r) => r.requester,
  status: (r) => r.status,
  lineCount: (r) => r.lineCount,
  totalRequestedQty: (r) => r.totalRequestedQty,
  totalApprovedQty: (r) => r.totalApprovedQty,
  totalFulfilledQty: (r) => r.totalFulfilledQty,
  approver: (r) => r.approver,
  approvedAt: (r) => (r.approvedAt ? new Date(r.approvedAt) : null),
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-100  text-amber-800',
  APPROVED:  'bg-blue-100   text-blue-800',
  FULFILLED: 'bg-green-100  text-green-800',
  REJECTED:  'bg-red-100    text-red-800',
  CANCELLED: 'bg-gray-100   text-gray-600',
};

const STATUS_ORDER = ['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED'];

export default async function RequestSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const { rows: rawRows, summary } = await requestSummaryReport({
    from:   sp.from   || undefined,
    to:     sp.to     || undefined,
    status: sp.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED' | undefined,
    q:      sp.q      || undefined,
    format: 'json',
  });

  const sortBy = resolveSort(sp.sortBy, REQUEST_SUMMARY_SORT_COLUMNS, 'createdAt');
  const sortDir = resolveSortDir(sp.sortDir, 'desc');
  const rows = sortRows(rawRows, requestSummaryGetters[sortBy], sortDir);

  const fulfilmentPct =
    summary.totalApprovedQty > 0
      ? Math.round((summary.totalFulfilledQty / summary.totalApprovedQty) * 100)
      : 0;

  // Sort status cards in logical order
  const statusCards = [...summary.byStatus].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

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
          <h1 className="text-2xl font-semibold text-foreground">Request Summary Report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {summary.total} request{summary.total !== 1 ? 's' : ''} in the selected period
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <ReportDateFilter
          extraFilters={[
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: STATUS_ORDER.map((s) => ({ value: s, label: s })),
            },
            {
              key: 'q',
              label: 'Requester',
              type: 'text',
              placeholder: 'Name…',
            },
          ]}
        />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total requests</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalFulfilledQty.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Units fulfilled</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalRequestedQty.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Units requested</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <XCircle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{fulfilmentPct}%</p>
            <p className="text-xs text-muted-foreground">Fulfilment rate</p>
          </div>
        </div>
      </div>

      {/* Status breakdown chips */}
      {statusCards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusCards.map((s) => {
            const p = new URLSearchParams();
            if (sp.from)   p.set('from', sp.from);
            if (sp.to)     p.set('to',   sp.to);
            if (sp.q)      p.set('q',    sp.q);
            p.set('status', s.status);
            return (
              <Link
                key={s.status}
                href={`?${p.toString()}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80 ${
                  sp.status === s.status
                    ? 'border-primary bg-primary text-primary-foreground'
                    : `border-transparent ${STATUS_BADGE[s.status] ?? 'bg-gray-100 text-gray-600'}`
                }`}
              >
                {s.status}
                <span className="rounded-full bg-black/10 px-1.5 py-0.5 font-bold">{s.count}</span>
              </Link>
            );
          })}
          {sp.status && (
            <Link
              href={(() => {
                const p = new URLSearchParams();
                if (sp.from) p.set('from', sp.from);
                if (sp.to)   p.set('to',   sp.to);
                if (sp.q)    p.set('q',    sp.q);
                return `?${p.toString()}`;
              })()}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Clear status
            </Link>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="createdAt" label="Date" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="requester" label="Requester" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="status" label="Status" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <th className="hidden lg:table-cell">Reason</th>
                <SortableHeader column="lineCount" label="Lines" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="hidden sm:table-cell !text-right" />
                <SortableHeader column="totalRequestedQty" label="Requested" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="totalApprovedQty" label="Approved" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="hidden md:table-cell !text-right" />
                <SortableHeader column="totalFulfilledQty" label="Fulfilled" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="hidden md:table-cell !text-right" />
                <SortableHeader column="approver" label="Approver" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden xl:table-cell" />
                <SortableHeader column="approvedAt" label="Approved On" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden xl:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.requester}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[row.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 max-w-xs lg:table-cell">
                    <p className="truncate text-xs text-muted-foreground" title={row.reason}>
                      {row.reason}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.lineCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {row.totalRequestedQty}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-blue-700 md:table-cell">
                    {row.totalApprovedQty > 0 ? row.totalApprovedQty : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-emerald-700 md:table-cell">
                    {row.totalFulfilledQty > 0 ? row.totalFulfilledQty : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                    {row.approver ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground whitespace-nowrap xl:table-cell">
                    {row.approvedAt ? formatDate(row.approvedAt) : '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-muted-foreground">
                    No requests found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length === 500 && (
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
            Showing first 500 records — narrow the date range for more specific results.
          </div>
        )}
      </div>
    </div>
  );
}
