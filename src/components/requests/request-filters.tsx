'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

const STATUSES = [
  { value: '',            label: 'All' },
  { value: 'PENDING',     label: 'Pending' },
  { value: 'APPROVED',    label: 'Approved' },
  { value: 'FULFILLED',   label: 'Fulfilled' },
  { value: 'REJECTED',    label: 'Rejected' },
  { value: 'CANCELLED',   label: 'Cancelled' },
] as const;

const activeStyles: Record<string, string> = {
  '':          'bg-foreground text-background',
  PENDING:     'bg-amber-100 text-amber-800',
  APPROVED:    'bg-emerald-100 text-emerald-800',
  FULFILLED:   'bg-blue-100 text-blue-800',
  REJECTED:    'bg-rose-100 text-rose-800',
  CANCELLED:   'bg-slate-200 text-slate-700',
};

export function RequestFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get('status') ?? '';

  const set = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) { params.set('status', value); } else { params.delete('status'); }
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`); });
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => set(s.value)}
          disabled={isPending}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            current === s.value
              ? activeStyles[s.value]
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
