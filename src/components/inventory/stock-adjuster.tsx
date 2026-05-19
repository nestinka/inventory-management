'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

const REASONS = [
  { value: 'RECEIVED',         label: 'Received (stock in)' },
  { value: 'CONSUMPTION',      label: 'Consumption' },
  { value: 'DAMAGE',           label: 'Damage / loss' },
  { value: 'EXPIRY',           label: 'Expired' },
  { value: 'AUDIT_CORRECTION', label: 'Audit correction' },
  { value: 'MANUAL_OVERRIDE',  label: 'Manual override' },
  { value: 'FULFILMENT',       label: 'Fulfilment' },
] as const;

type Reason = typeof REASONS[number]['value'];

interface Props {
  itemId: string;
  currentStock: number;
  onSuccess?: () => void;
}

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function StockAdjuster({ itemId, currentStock, onSuccess }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [reason, setReason] = useState<Reason>('RECEIVED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delta = direction === '+' ? qty : -qty;
  const projected = currentStock + delta;

  const submit = async () => {
    if (projected < 0) {
      setError(`Adjustment would go below zero (${currentStock} + ${delta} = ${projected})`);
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch('/api/v1/stock/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, delta, reason, note: note.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setError(data.message ?? 'Adjustment failed');
      return;
    }
    setQty(1);
    setNote('');
    setDirection('+');
    onSuccess?.();
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Adjust stock</h3>

      {/* Direction + qty row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* +/- toggle */}
        <div className="flex overflow-hidden rounded-lg border border-input">
          {([
            { d: '+', label: 'Add to stock' },
            { d: '-', label: 'Remove from stock' },
          ] as const).map(({ d, label }) => (
            <Tooltip key={d} content={label} side="top">
              <button
                type="button"
                onClick={() => setDirection(d)}
                className={`w-10 py-2 text-sm font-semibold transition-colors first:border-r first:border-input ${
                  direction === d
                    ? d === '+' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
                aria-pressed={direction === d}
              >
                {d}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Qty stepper */}
        <div className="flex items-center gap-1">
          <Tooltip content="Decrease by 0.5" side="top">
            <button
              type="button"
              onClick={() => setQty((v) => Math.max(0.5, Math.round((v - 0.5) * 10) / 10))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={qty}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && isFinite(v) && v >= 0.5) {
                setQty(Math.round(v * 10) / 10);
              }
            }}
            className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Quantity"
          />
          <Tooltip content="Increase by 0.5" side="top">
            <button
              type="button"
              onClick={() => setQty((v) => Math.round((v + 0.5) * 10) / 10)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Preview */}
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {currentStock}{' '}→{' '}
          <span className={projected < 0 ? 'font-semibold text-destructive' : 'font-semibold text-foreground'}>
            {projected}
          </span>
        </span>
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Reason <span className="text-destructive">*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as Reason)}
          className={inputCls}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Note</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Optional note"
          className={inputCls}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || projected < 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Apply adjustment
      </button>
    </div>
  );
}
