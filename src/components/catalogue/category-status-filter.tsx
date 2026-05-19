'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'ACTIVE',   label: 'Active',   active: 'bg-emerald-100 text-emerald-800' },
  { value: 'INACTIVE', label: 'Inactive', active: 'bg-slate-200 text-slate-700' },
] as const;

export function CategoryStatusFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get('status') ?? 'ACTIVE';

  const set = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', value);
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`); });
  };

  return (
    <div className="flex gap-2" role="group" aria-label="Filter by status">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set(o.value)}
          disabled={isPending}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            current === o.value ? o.active : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
