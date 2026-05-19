import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { listItems } from '@/server/modules/items';
import { QuickStockList } from '@/components/inventory/quick-stock-list';

export const metadata: Metadata = { title: 'Quick Stock Update' };
export const dynamic = 'force-dynamic';

export default async function QuickStockUpdatePage() {
  await headers(); // pre-warm Next.js 15 async headers cache before NextAuth v5-beta accesses it
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'EDITOR')) redirect('/');

  // Paginate through all items (listItems max is 100 per page)
  type ListedItem = Awaited<ReturnType<typeof listItems>>['data'][number];
  const allItems: ListedItem[] = [];
  let cursor: string | undefined;
  do {
    const { data, nextCursor } = await listItems({ limit: 100, cursor });
    allItems.push(...data);
    cursor = nextCursor ?? undefined;
  } while (cursor);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Quick Stock Update</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quickly adjust stock levels for your inventory items
        </p>
      </div>
      <QuickStockList items={allItems} />
    </div>
  );
}
