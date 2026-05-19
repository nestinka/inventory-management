import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { lowStockReport } from '@/server/modules/reports';

export const metadata: Metadata = { title: 'Low Stock Report' };
export const dynamic = 'force-dynamic';

export default async function LowStockReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  // Low-stock reflects current state; no date filter applicable.
  await searchParams; // consumed to satisfy Next.js dynamic page contract
  const data = await lowStockReport();

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
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Threshold</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Shortfall</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">State</th>
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
