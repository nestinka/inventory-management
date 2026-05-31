import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { lowStockReport } from '@/server/modules/reports';
import { SortableHeader } from '@/components/ui/sortable-header';
import { resolveSort, resolveSortDir, sortRows, type SortGetter } from '@/lib/sort';

export const metadata: Metadata = { title: 'Low Stock Report' };
export const dynamic = 'force-dynamic';

const LOW_STOCK_SORT_COLUMNS = ['name', 'category', 'currentStock', 'reorderThreshold', 'shortfall', 'stockState'] as const;
type LowStockSortColumn = (typeof LOW_STOCK_SORT_COLUMNS)[number];

type LowStockRow = { name: string; category: string; currentStock: number; reorderThreshold: number; stockState: string };

const lowStockGetters: Record<LowStockSortColumn, SortGetter<LowStockRow>> = {
  name: (r) => r.name,
  category: (r) => r.category,
  currentStock: (r) => r.currentStock,
  reorderThreshold: (r) => r.reorderThreshold,
  shortfall: (r) => r.reorderThreshold - r.currentStock,
  stockState: (r) => r.stockState,
};

export default async function LowStockReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const raw = await lowStockReport();

  const sortBy = resolveSort(sp.sortBy, LOW_STOCK_SORT_COLUMNS, 'shortfall');
  const sortDir = resolveSortDir(sp.sortDir, 'desc');
  const data = sortRows(raw, lowStockGetters[sortBy], sortDir);

  const outOfStock = data.filter((r) => r.stockState === 'OUT');
  const belowThreshold = data.filter((r) => r.stockState === 'LOW');

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
          <h1 className="text-2xl font-semibold text-foreground">Low Stock</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {outOfStock.length} out of stock · {belowThreshold.length} below threshold
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-foreground">{outOfStock.length} Out of stock</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-sm font-medium text-foreground">{belowThreshold.length} Below threshold</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="name" label="Name" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="category" label="Category" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <SortableHeader column="currentStock" label="Stock" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="reorderThreshold" label="Threshold" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="shortfall" label="Shortfall" currentSort={sortBy} currentDir={sortDir} searchParams={sp} align="right" className="!text-right" />
                <SortableHeader column="stockState" label="State" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => {
                const shortfall = row.reorderThreshold - row.currentStock;
                const isOut = row.stockState === 'OUT';
                return (
                  <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                      {row.currentStock}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.reorderThreshold}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {shortfall > 0 ? `+${shortfall}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isOut ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.stockState}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    All items are at healthy stock levels.
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
