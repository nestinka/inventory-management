import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight, Tag, Ruler, Calendar } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { getItem, getItemHistory } from '@/server/modules/items';
import { StockBadge } from '@/components/ui/stock-badge';
import { StockAdjuster } from '@/components/inventory/stock-adjuster';
import { formatDate, formatDateTime, isWithinDays } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ itemId: string }> }): Promise<Metadata> {
  const { itemId } = await params;
  const item = await getItem(itemId).catch(() => null);
  return { title: item ? `${item.name} | Inventory` : 'Item' };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor) redirect('/login');

  const { itemId } = await params;
  const [item, history] = await Promise.all([
    getItem(itemId).catch(() => null),
    getItemHistory(itemId, { limit: 30 }).catch(() => ({ data: [] as never[], nextCursor: null })),
  ]);

  if (!item) notFound();

  const canAdjust = actor.role === 'ADMIN' || actor.role === 'EDITOR';
  const isNearExpiry = isWithinDays(item.expiryDate, 30);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/inventory" className="hover:text-foreground transition-colors">Inventory</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{item.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">{item.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: meta + adjuster */}
        <div className="space-y-4">
          {/* Meta card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge state={item.stockState} stock={item.currentStock} />
              {isNearExpiry && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Near expiry
                </span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                item.status === 'ACTIVE'   ? 'bg-emerald-50 text-emerald-700' :
                item.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600' :
                                             'bg-rose-50 text-rose-700'
              }`}>
                {item.status.toLowerCase()}
              </span>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.category.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.unitOfMeasure}</span>
              </div>
              {item.expiryDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className={isNearExpiry ? 'font-medium text-amber-600' : ''}>
                    Expires {formatDate(item.expiryDate)}
                  </span>
                </div>
              )}
              {item.reorderThreshold > 0 && (
                <p className="text-xs">Reorder threshold: {item.reorderThreshold}</p>
              )}
            </div>

            {item.description && (
              <p className="text-sm text-foreground border-t border-border pt-3">{item.description}</p>
            )}
          </div>

          {/* Stock adjuster */}
          {canAdjust && (
            <StockAdjuster itemId={item.id} currentStock={item.currentStock} />
          )}
        </div>

        {/* Right: history timeline */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Adjustment history
            <span className="ml-2 text-sm font-normal text-muted-foreground">({history.data.length} entries)</span>
          </h2>

          {history.data.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              No adjustments yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="divide-y divide-border">
                {history.data.map((adj) => (
                  <div key={adj.id} className="flex items-start gap-4 px-4 py-3">
                    {/* Delta badge */}
                    <span
                      className={`mt-0.5 inline-flex w-14 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ${
                        adj.delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                      aria-label={`Delta: ${adj.delta > 0 ? '+' : ''}${adj.delta}`}
                    >
                      {adj.delta > 0 ? '+' : ''}{adj.delta}
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-medium text-foreground capitalize">
                          {adj.reason.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        <span className="text-muted-foreground text-xs">balance → {adj.balanceAfter}</span>
                        <span className="text-muted-foreground text-xs">by {adj.actor.name}</span>
                      </div>
                      {adj.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{adj.note}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(adj.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
