import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import { auth } from '@/lib/auth';
import { listItems } from '@/server/modules/items';
import { listCategories } from '@/server/modules/categories';
import { StockBadge } from '@/components/ui/stock-badge';
import { Pagination } from '@/components/ui/pagination';
import { DeleteItemButton } from '@/components/catalogue/delete-item-button';
import { InventoryFilters } from '@/components/inventory/inventory-filters';
import { formatDate } from '@/lib/utils';
import type { Actor } from '@/server/auth/rbac';

export const metadata: Metadata = { title: 'Items' };
export const dynamic = 'force-dynamic';

// ─── URL search-param shape ───────────────────────────────────────────────────

interface SearchParams {
  q?: string;
  categoryId?: string;
  status?: string;
  stockState?: string;
  /** Cursor for the current page. Absent = first page. */
  cursor?: string;
  /**
   * Comma-separated stack of previous-page cursors (oldest first).
   * `_` is the sentinel for "page 1 has no cursor".
   * Example on page 4: `_,C2,C3`
   */
  stack?: string;
}

const PAGE_SIZE = 25;

// ─── Pagination URL builders ──────────────────────────────────────────────────

function filterBase(sp: SearchParams) {
  const p = new URLSearchParams();
  if (sp.q)          p.set('q',          sp.q);
  if (sp.categoryId) p.set('categoryId', sp.categoryId);
  if (sp.status)     p.set('status',     sp.status);
  if (sp.stockState) p.set('stockState', sp.stockState);
  return p;
}

function buildNextUrl(sp: SearchParams, nextCursor: string): string {
  const p = filterBase(sp);
  p.set('cursor', nextCursor);
  // Push current cursor onto the stack (use '_' sentinel for page-1 "no cursor")
  const entry    = sp.cursor || '_';
  const newStack = sp.stack ? `${sp.stack},${entry}` : entry;
  p.set('stack', newStack);
  return `/catalogue/items?${p.toString()}`;
}

function buildPrevUrl(sp: SearchParams): string {
  const p     = filterBase(sp);
  const parts = (sp.stack ?? '').split(',').filter(Boolean);
  const prev  = parts.pop();                          // cursor for the page we're going back to

  if (prev && prev !== '_') p.set('cursor', prev);   // '_' = page 1, no cursor param
  if (parts.length > 0)     p.set('stack', parts.join(','));

  return `/catalogue/items?${p.toString()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CatalogueItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'EDITOR')) redirect('/');

  const sp = await searchParams;

  const [{ data: items, nextCursor }, { data: categories }] = await Promise.all([
    listItems({
      q:          sp.q          || undefined,
      categoryId: sp.categoryId || undefined,
      status:     sp.status     as never  || undefined,
      stockState: sp.stockState as never  || undefined,
      cursor:     sp.cursor     || undefined,
      limit:      PAGE_SIZE,
    }),
    listCategories({ limit: 100 }),
  ]);

  const hasPrev = !!sp.stack;
  const prevUrl = hasPrev        ? buildPrevUrl(sp)               : null;
  const nextUrl = !!nextCursor   ? buildNextUrl(sp, nextCursor)   : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Catalogue</span>
            <span>/</span>
            <span className="text-foreground">Items</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Items</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} items shown</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/catalogue/categories"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Categories
          </Link>
          <Link
            href="/catalogue/items/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New item
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Suspense>
        <InventoryFilters categories={categories} clearParams={['cursor', 'stack']} />
      </Suspense>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Expiry</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{item.category.name}</td>
                  <td className="px-4 py-3">
                    <StockBadge state={item.stockState} stock={item.currentStock} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {item.expiryDate ? formatDate(item.expiryDate) : <span className="text-border">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === 'ACTIVE'   ? 'bg-emerald-50 text-emerald-700' :
                      item.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600' :
                                                   'bg-rose-50 text-rose-700'
                    }`}>
                      {item.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/catalogue/items/${item.id}/adjust`}
                        title="Adjust stock"
                        aria-label={`Adjust stock for ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </Link>
                      {actor.role === 'ADMIN' && (
                        <>
                          <Link
                            href={`/catalogue/items/${item.id}/edit`}
                            title="Edit item"
                            aria-label={`Edit ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <DeleteItemButton itemId={item.id} itemName={item.name} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No items found.{' '}
                    {!sp.q && !sp.categoryId && !sp.status && !sp.stockState && (
                      <Link href="/catalogue/items/new" className="text-primary hover:underline">
                        Create one
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination prevUrl={prevUrl} nextUrl={nextUrl} />
    </div>
  );
}
