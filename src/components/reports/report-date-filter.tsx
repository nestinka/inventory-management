'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useRef } from 'react';

interface ExtraFilter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

interface ReportDateFilterProps {
  extraFilters?: ExtraFilter[];
  /** Base path for constructing the URL (defaults to current path, relative push) */
  basePath?: string;
}

const inputCls =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function ReportDateFilter({ extraFilters = [] }: ReportDateFilterProps) {
  const sp = useSearchParams();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(updates: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`?${params.toString()}`);
  }

  function handleDebounced(key: string, val: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ [key]: val }), 300);
  }

  const hasFilters =
    sp.get('from') ||
    sp.get('to') ||
    extraFilters.some((f) => sp.get(f.key));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {/* From date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          className={inputCls}
          defaultValue={sp.get('from')?.slice(0, 10) ?? ''}
          onChange={(e) =>
            push({ from: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })
          }
          aria-label="Filter from date"
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          className={inputCls}
          defaultValue={sp.get('to')?.slice(0, 10) ?? ''}
          onChange={(e) =>
            push({ to: e.target.value ? `${e.target.value}T23:59:59.999Z` : '' })
          }
          aria-label="Filter to date"
        />
      </div>

      {/* Extra filters */}
      {extraFilters.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
          {f.type === 'select' ? (
            <select
              className={`${inputCls} pr-8`}
              defaultValue={sp.get(f.key) ?? ''}
              onChange={(e) => push({ [f.key]: e.target.value })}
            >
              <option value="">All</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'number' ? (
            <input
              type="number"
              className={`${inputCls} w-24`}
              defaultValue={sp.get(f.key) ?? ''}
              placeholder={f.placeholder}
              min={f.min}
              max={f.max}
              onChange={(e) => handleDebounced(f.key, e.target.value)}
            />
          ) : (
            <input
              type="text"
              className={`${inputCls} w-44`}
              defaultValue={sp.get(f.key) ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => handleDebounced(f.key, e.target.value)}
            />
          )}
        </div>
      ))}

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => {
            const keys = ['from', 'to', ...extraFilters.map((f) => f.key)];
            const params = new URLSearchParams(sp.toString());
            keys.forEach((k) => params.delete(k));
            router.push(`?${params.toString()}`);
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
