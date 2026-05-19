import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { inventorySnapshot } from '@/server/modules/reports';
import { prisma } from '@/server/db/client';
import { ReportDateFilter } from '@/components/reports/report-date-filter';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Inventory Snapshot' };
export const dynamic = 'force-dynamic';

const STOCK_STATE_STYLES = {
  HEALTHY: 'bg-emerald-100 text-emerald-800',
  LOW:     'bg-amber-100  text-amber-800',
  OUT:     'bg-red-100    text-red-800',
} as const;

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const [data, categories] = await Promise.all([
    inventorySnapshot({
      q:          sp.q          || undefined,
      categoryId: sp.categoryId || undefined,
      stockState: (sp.stockState as 'HEALTHY' | 'LOW' | 'OUT') || undefined,
      from:       sp.from       || undefined,
      to:         sp.to         || undefined,
      format:     'json',
    }),
    prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

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
          <h1 className="text-2xl font-semibold text-foreground">Current Inventory</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.length} active item{data.length !== 1 ? 's' : ''} — filtered by item creation date
          </p>
        </div>
      </div>

      <Suspense>
        <ReportDateFilter
          extraFilters={[
            {
              key: 'q',
              label: 'Search',
              type: 'text',
              placeholder: 'Name…',
            },
            {
              key: 'categoryId',
              label: 'Category',
              type: 'select',
              options: categories.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              key: 'stockState',
              label: 'Stock state',
              type: 'select',
              options: [
                { value: 'HEALTHY', label: 'Healthy' },
                { value: 'LOW',     label: 'Low' },
                { value: 'OUT',     label: 'Out' },
              ],
            },
          ]}
        />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Threshold</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">State</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Unit</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                    {row.currentStock}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                    {row.reorderThreshold}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STATE_STYLES[row.stockState]}`}
                    >
                      {row.stockState}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {row.unitOfMeasure}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {row.expiryDate ? formatDate(row.expiryDate) : '—'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No items match the selected filters.
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
