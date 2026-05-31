import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { listCategories, CATEGORY_SORTABLE_COLUMNS } from '@/server/modules/categories';
import { CategoryStatusButton } from '@/components/catalogue/category-status-button';
import { CategoryStatusFilter } from '@/components/catalogue/category-status-filter';
import { SortableHeader, type SortDir } from '@/components/ui/sortable-header';
import { formatDate } from '@/lib/utils';
import type { Actor } from '@/server/auth/rbac';
import { CategoryStatus } from '@prisma/client';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role !== 'ADMIN') redirect('/');

  const sp = await searchParams;
  const statusFilter = Object.values(CategoryStatus).includes(sp.status as CategoryStatus)
    ? (sp.status as CategoryStatus)
    : CategoryStatus.ACTIVE;

  const sortBy = (CATEGORY_SORTABLE_COLUMNS as readonly string[]).includes(sp.sortBy ?? '')
    ? (sp.sortBy as (typeof CATEGORY_SORTABLE_COLUMNS)[number])
    : 'name';
  const sortDir: SortDir = sp.sortDir === 'desc' ? 'desc' : 'asc';

  const { data: categories } = await listCategories({ limit: 100, status: statusFilter, sortBy, sortDir });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">{categories.length} {statusFilter.toLowerCase()}</p>
        </div>
        <Link
          href="/catalogue/categories/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          New category
        </Link>
      </div>

      {/* Status filter chips */}
      <Suspense>
        <CategoryStatusFilter />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground">
                <SortableHeader column="name" label="Name" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <th className="hidden md:table-cell">Description</th>
                <SortableHeader column="status" label="Status" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
                <SortableHeader column="createdAt" label="Created" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
                <th className="!text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {cat.description ?? <span className="text-border">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      cat.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {cat.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatDate(cat.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/catalogue/categories/${cat.id}/edit`}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </Link>
                      <CategoryStatusButton
                        categoryId={cat.id}
                        categoryName={cat.name}
                        currentStatus={cat.status}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No {statusFilter.toLowerCase()} categories.{' '}
                    {statusFilter === 'ACTIVE' && (
                      <Link href="/catalogue/categories/new" className="text-primary hover:underline">
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
    </div>
  );
}
