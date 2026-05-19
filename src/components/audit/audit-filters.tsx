'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useRef, useTransition, useState } from 'react';

export function AuditFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [action, setAction] = useState(sp.get('action') ?? '');
  const [from, setFrom] = useState(sp.get('from')?.slice(0, 10) ?? '');
  const [to, setTo] = useState(sp.get('to')?.slice(0, 10) ?? '');

  function push(updates: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    params.delete('cursor'); // reset pagination on filter change
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    startTransition(() => router.push(`/audit?${params.toString()}`));
  }

  function handleActionChange(val: string) {
    setAction(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ action: val }), 300);
  }

  const hasFilters = !!(sp.get('action') || sp.get('from') || sp.get('to'));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-filter-action" className="text-xs font-medium text-muted-foreground">Action prefix</label>
        <input
          id="audit-filter-action"
          type="text"
          value={action}
          onChange={(e) => handleActionChange(e.target.value)}
          placeholder="e.g. item.adjust"
          className="h-9 w-48 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-filter-from" className="text-xs font-medium text-muted-foreground">From</label>
        <input
          id="audit-filter-from"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            push({ from: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' });
          }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="audit-filter-to" className="text-xs font-medium text-muted-foreground">To</label>
        <input
          id="audit-filter-to"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            push({ to: e.target.value ? `${e.target.value}T23:59:59.999Z` : '' });
          }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {hasFilters && (
        <button
          onClick={() => {
            setAction('');
            setFrom('');
            setTo('');
            push({ action: '', from: '', to: '' });
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-accent"
        >
          Clear
        </button>
      )}
    </div>
  );
}
