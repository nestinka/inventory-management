'use client';

import { useState, useMemo } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type StockState = 'HEALTHY' | 'LOW' | 'OUT';
type Reason = 'RECEIVED' | 'CONSUMPTION' | 'DAMAGE' | 'EXPIRY' | 'AUDIT_CORRECTION' | 'MANUAL_OVERRIDE' | 'FULFILMENT';

export interface QuickItem {
  id: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  currentStock: number;
  reorderThreshold: number;
  category: { id: string; name: string };
}

interface ItemState {
  stock: number;
  pending: boolean;
  flash: 'success' | 'error' | null;
  errorMsg: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REASONS: { value: Reason; label: string }[] = [
  { value: 'CONSUMPTION',      label: 'Consumption' },
  { value: 'RECEIVED',         label: 'Received (stock in)' },
  { value: 'DAMAGE',           label: 'Damage / loss' },
  { value: 'EXPIRY',           label: 'Expired' },
  { value: 'AUDIT_CORRECTION', label: 'Audit correction' },
  { value: 'MANUAL_OVERRIDE',  label: 'Manual override' },
  { value: 'FULFILMENT',       label: 'Fulfilment' },
];

const STEPS = [0.5, 1, 5, 10] as const;
type Step = (typeof STEPS)[number];

const BADGE_BG: Record<StockState, string> = {
  HEALTHY: 'bg-emerald-700',
  LOW:     'bg-amber-700',
  OUT:     'bg-rose-700',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveStockState(stock: number, reorderThreshold: number): StockState {
  if (stock <= 0) return 'OUT';
  if (reorderThreshold > 0 && stock < reorderThreshold) return 'LOW';
  return 'HEALTHY';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickStockList({ items }: { items: QuickItem[] }) {
  const [query,  setQuery]  = useState('');
  const [reason, setReason] = useState<Reason>('CONSUMPTION');
  const [step,   setStep]   = useState<Step>(1);

  const [states, setStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        { stock: item.currentStock, pending: false, flash: null, errorMsg: null },
      ])
    )
  );

  // Client-side search — name, category, description
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  // Patch a single item's state
  const patch = (id: string, update: Partial<ItemState>) =>
    setStates((prev) => ({ ...prev, [id]: { ...prev[id]!, ...update } }));

  const handleAdjust = async (item: QuickItem, delta: number) => {
    const cur  = states[item.id]?.stock ?? item.currentStock;
    const next = cur + delta;
    if (next < 0) return;

    // Optimistic update
    patch(item.id, { stock: next, pending: true, flash: null, errorMsg: null });

    try {
      const res = await fetch('/api/v1/stock/adjust', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ itemId: item.id, delta, reason }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        patch(item.id, { stock: cur, pending: false, flash: 'error', errorMsg: data.message ?? 'Adjustment failed' });
      } else {
        patch(item.id, { pending: false, flash: 'success', errorMsg: null });
      }
    } catch {
      patch(item.id, { stock: cur, pending: false, flash: 'error', errorMsg: 'Network error' });
    }

    // Auto-clear flash after 1.5 s
    setTimeout(() => patch(item.id, { flash: null }), 1500);
  };

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search items or categories"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or categories…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Reason */}
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as Reason)}
          aria-label="Adjustment reason"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Step selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Per click:</span>
          <div className="flex overflow-hidden rounded-lg border border-input text-xs font-medium">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                aria-pressed={step === s}
                className={`px-3 py-2 transition-colors ${i > 0 ? 'border-l border-input' : ''} ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">{filtered.length} items found</p>

      {/* ── Item list ── */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {filtered.map((item) => {
          const st         = states[item.id] ?? { stock: item.currentStock, pending: false, flash: null, errorMsg: null };
          const stockState = deriveStockState(st.stock, item.reorderThreshold);

          return (
            <div key={item.id} className="flex items-center gap-4 px-4 py-4">
              {/* Left: item meta */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.category.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}

                {/* Stock badge + unit */}
                <div className="mt-2 flex items-end gap-2">
                  <div
                    className={[
                      'relative flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white',
                      'transition-all duration-200',
                      BADGE_BG[stockState],
                      st.flash === 'success' ? 'ring-2 ring-offset-1 ring-emerald-300 scale-105' : '',
                      st.flash === 'error'   ? 'ring-2 ring-offset-1 ring-rose-300'              : '',
                    ].join(' ')}
                    aria-label={`${item.name}: ${st.stock} ${item.unitOfMeasure}`}
                  >
                    {st.pending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span>{Number(st.stock.toFixed(2))}</span>
                    }
                  </div>
                  <span className="pb-1.5 text-xs text-muted-foreground">{item.unitOfMeasure}</span>
                </div>

                {/* Per-item error */}
                {st.errorMsg && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {st.errorMsg}
                  </p>
                )}
              </div>

              {/* Right: −/+ buttons */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjust(item, -step)}
                  disabled={st.pending || st.stock < step}
                  aria-label={`Decrease ${item.name} by ${step}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-xl font-bold text-white shadow-sm transition-all hover:bg-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(item, step)}
                  disabled={st.pending}
                  aria-label={`Increase ${item.name} by ${step}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No items found.
          </div>
        )}
      </div>
    </div>
  );
}
