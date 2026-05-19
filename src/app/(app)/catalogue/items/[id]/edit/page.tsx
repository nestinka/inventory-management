import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { getItem } from '@/server/modules/items';
import { listCategories } from '@/server/modules/categories';
import { ItemForm } from '@/components/catalogue/item-form';

export const metadata: Metadata = { title: 'Edit Item' };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/');

  const { id } = await params;
  const [item, { data: categories }] = await Promise.all([
    getItem(id).catch(() => null),
    listCategories({ limit: 100 }),
  ]);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/catalogue/items" className="hover:text-foreground transition-colors">Items</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{item.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Edit Item</h1>
      </div>
      <ItemForm
        itemId={id}
        categories={categories}
        defaultValues={{
          name: item.name,
          description: item.description ?? undefined,
          unitOfMeasure: item.unitOfMeasure,
          categoryId: item.categoryId,
          reorderThreshold: item.reorderThreshold,
          expiryDate: item.expiryDate ? item.expiryDate.toISOString().slice(0, 10) : undefined,
          status: item.status as 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED',
        }}
      />
    </div>
  );
}
