import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame, BarChart2, CalendarDays, Layers } from 'lucide-react';
import { monthlyUsageReport } from '@/server/modules/reports';
import { prisma } from '@/server/db/client';
import { ReportDateFilter } from '@/components/reports/report-date-filter';

export const metadata: Metadata = { title: 'Monthly Usage Report' };
export const dynamic = 'force-dynamic';

/** "2024-03"  →  "Mar 2024" */
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
}

export default async function MonthlyUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const [{ rows, summary }, categories] = await Promise.all([
    monthlyUsageReport({
      from:       sp.from       || undefined,
      to:         sp.to         || undefined,
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

  // Unique months in ascending order for the "months covered" display
  const months = Array.from(new Set(rows.map((r) => r.month))).sort();

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
          <h1 className="text-2xl font-semibold text-foreground">Monthly Usage Report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Item consumption and usage patterns across{' '}
            {months.length > 0 ? `${months.length} month${months.length !== 1 ? 's' : ''}` : 'the selected range'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <ReportDateFilter
          extraFilters={[
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalUnitsConsumed.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Units consumed</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <BarChart2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.totalTransactions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">
              {summary.peakMonth ? fmtMonth(summary.peakMonth) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Peak month</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">
              {new Set(rows.map((r) => r.itemId)).size}
            </p>
            <p className="text-xs text-muted-foreground">Distinct items</p>
          </div>
        </div>
      </div>

      {/* Top 5 items */}
      {summary.topItems.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Top Consumed Items</h2>
          </div>
          <div className="divide-y divide-border">
            {summary.topItems.map((item, idx) => {
              const pct =
                summary.totalUnitsConsumed > 0
                  ? Math.round((item.unitsConsumed / summary.totalUnitsConsumed) * 100)
                  : 0;
              return (
                <div key={item.itemName} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.itemName}</p>
                  </div>
                  {/* Progress bar */}
                  <div className="hidden w-32 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-24 text-right text-sm tabular-nums text-foreground">
                    {item.unitsConsumed.toLocaleString()} <span className="text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            Monthly Breakdown <span className="font-normal text-muted-foreground">({rows.length} rows)</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Month</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Units Consumed</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Transactions</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Avg / Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.month}-${row.itemId}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                    {fmtMonth(row.month)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.itemName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {row.category}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600">
                    {row.unitsConsumed.toLocaleString()}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {row.transactions}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                    {row.avgPerTransaction}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    No consumption data for the selected filters.
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
