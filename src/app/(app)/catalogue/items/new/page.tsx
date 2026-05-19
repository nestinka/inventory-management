import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { listCategories } from '@/server/modules/categories';
import { ItemForm } from '@/components/catalogue/item-form';

export const metadata: Metadata = { title: 'New Item' };

export default async function NewItemPage() {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/');

  const { data: categories } = await listCategories({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/catalogue/items" className="hover:text-foreground transition-colors">Items</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">New</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">New Item</h1>
      </div>
      <ItemForm categories={categories} />
    </div>
  );
}
