import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { getCategory } from '@/server/modules/categories';
import { CategoryForm } from '@/components/catalogue/category-form';

export const metadata: Metadata = { title: 'Edit Category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/');

  const { id } = await params;
  const category = await getCategory(id).catch(() => null);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/catalogue/categories" className="hover:text-foreground transition-colors">Categories</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{category.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-foreground">Edit Category</h1>
      </div>
      <CategoryForm
        categoryId={id}
        defaultValues={{
          name: category.name,
          description: category.description ?? undefined,
        }}
      />
    </div>
  );
}
