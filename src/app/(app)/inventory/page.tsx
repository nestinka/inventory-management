import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { listItems } from '@/server/modules/items';
import { listCategories } from '@/server/modules/categories';
import { StockBadge } from '@/components/ui/stock-badge';
import { InventoryFilters } from '@/components/inventory/inventory-filters';
import { formatDate, isWithinDays } from '@/lib/utils';

export const metadata: Metadata = { title: 'Inventory' };
export const dynamic = 'force-dynamic';

interface SearchParams { q?: string; categoryId?: string; status?: string; stockState?: string; nearExpiryDays?: string }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [{ data: items }, { data: categories }] = await Promise.all([
    listItems({
      q: sp.q,
      categoryId: sp.categoryId,
      status: sp.status as never,
      stockState: sp.stockState as never,
      nearExpiryDays: sp.nearExpiryDays ? Number(sp.nearExpiryDays) : undefined,
      limit: 50,
    }),
    listCategories({ limit: 100 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} items shown</p>
        </div>
      </div>

      <Suspense>
        <InventoryFilters categories={categories} />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Expiry</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/inventory/${item.id}`} className="hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category.name}</td>
                  <td className="px-4 py-3">
                    <StockBadge state={item.stockState} stock={item.currentStock} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {item.expiryDate ? (
                      <span className={isWithinDays(item.expiryDate, 30) ? 'text-amber-700 font-medium' : ''}>
                        {formatDate(item.expiryDate)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                      item.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600' :
                      'bg-rose-50 text-rose-700'
                    }`}>
                      {item.status.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No items found.
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
