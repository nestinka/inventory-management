'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';

interface Category { id: string; name: string }

interface Props {
  categories: Category[];
  /** Extra URL params to delete whenever any filter changes (e.g. pagination cursors). */
  clearParams?: string[];
}

export function InventoryFilters({ categories, clearParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) { params.set(key, value); } else { params.delete(key); }
      clearParams?.forEach((p) => params.delete(p));
      startTransition(() => { router.replace(`${pathname}?${params.toString()}`); });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname, searchParams],
  );

  const clear = useCallback(() => {
    startTransition(() => { router.replace(pathname); });
  }, [router, pathname]);

  const hasFilters = ['q', 'categoryId', 'status', 'stockState'].some((k) => searchParams.has(k));

  return (
    <div className={`flex flex-wrap gap-2 items-center transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {/* Text search */}
      <div className="relative flex-1 min-w-44">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search items by name"
          placeholder="Search name…"
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => update('q', e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category */}
      <select
        key={`cat-${searchParams.get('categoryId')}`}
        aria-label="Filter by category"
        defaultValue={searchParams.get('categoryId') ?? ''}
        onChange={(e) => update('categoryId', e.target.value)}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Status */}
      <select
        key={`status-${searchParams.get('status')}`}
        aria-label="Filter by status"
        defaultValue={searchParams.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="DISCONTINUED">Discontinued</option>
      </select>

      {/* Stock state */}
      <select
        key={`stock-${searchParams.get('stockState')}`}
        aria-label="Filter by stock state"
        defaultValue={searchParams.get('stockState') ?? ''}
        onChange={(e) => update('stockState', e.target.value)}
        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All stock states</option>
        <option value="HEALTHY">Healthy</option>
        <option value="LOW">Low stock</option>
        <option value="OUT">Out of stock</option>
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clear}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
