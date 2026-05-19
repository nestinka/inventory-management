'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Line {
  id: string;
  requestedQty: number;
  approvedQty: number | null;
  item: { name: string };
}

interface Props {
  requestId: string;
  status: string;
  lines: Line[];
  canAdmin: boolean;
  isOwner: boolean;
}

type Mode = 'approve' | 'reject' | 'cancel' | 'fulfil' | null;

const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const btnDanger  = 'flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const btnGhost   = 'rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors';
const inputCls   = 'w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function RequestActionPanel({ requestId, status, lines, canAdmin, isOwner }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [lineQtys, setLineQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.approvedQty ?? l.requestedQty]))
  );

  const reset = () => { setMode(null); setError(null); setNote(''); };

  const call = async (url: string, body?: object) => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setError(data.message ?? 'Action failed');
      return false;
    }
    reset();
    router.refresh();
    return true;
  };

  const handleApprove = () => call(`/api/v1/requests/${requestId}/approve`, {
    lines: lines.map((l) => ({ lineId: l.id, approvedQty: lineQtys[l.id] ?? l.requestedQty })),
    note: note.trim() || undefined,
  });

  const handleReject = () => call(`/api/v1/requests/${requestId}/reject`, { note });

  const handleCancel = () => call(`/api/v1/requests/${requestId}/cancel`);

  const handleFulfil = () => call(`/api/v1/requests/${requestId}/fulfil`, {
    lines: lines.map((l) => ({ lineId: l.id, fulfilledQty: lineQtys[l.id] ?? 0 })),
  });

  const hasActions =
    (status === 'PENDING' && (canAdmin || isOwner)) ||
    (status === 'APPROVED' && (canAdmin || isOwner));

  if (!hasActions) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Actions</h3>

      {/* Idle: show action buttons */}
      {!mode && (
        <div className="flex flex-wrap gap-2">
          {status === 'PENDING' && canAdmin && (
            <>
              <button type="button" onClick={() => { setLineQtys(Object.fromEntries(lines.map((l) => [l.id, l.requestedQty]))); setMode('approve'); }} className={btnPrimary}>
                Approve
              </button>
              <button type="button" onClick={() => setMode('reject')} className={btnDanger}>
                Reject
              </button>
            </>
          )}
          {status === 'APPROVED' && canAdmin && (
            <button type="button" onClick={() => { setLineQtys(Object.fromEntries(lines.map((l) => [l.id, l.approvedQty ?? 0]))); setMode('fulfil'); }} className={btnPrimary}>
              Fulfil
            </button>
          )}
          {(status === 'PENDING' || status === 'APPROVED') && (canAdmin || isOwner) && (
            <button type="button" onClick={() => setMode('cancel')} className={btnGhost}>
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Approve form */}
      {mode === 'approve' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Set approved quantity per line (cannot exceed requested):</p>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-foreground truncate">{l.item.name}</span>
                <span className="text-xs text-muted-foreground">/ {l.requestedQty}</span>
                <input
                  type="number"
                  min={0}
                  max={l.requestedQty}
                  value={lineQtys[l.id] ?? l.requestedQty}
                  onChange={(e) => setLineQtys((prev) => ({ ...prev, [l.id]: Math.min(l.requestedQty, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleApprove} disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm approve
            </button>
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Reject form */}
      {mode === 'reject' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Rejection reason <span className="text-destructive">*</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleReject} disabled={busy || !note.trim()} className={btnDanger}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm reject
            </button>
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Fulfil form */}
      {mode === 'fulfil' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Set fulfilled quantity per line (cannot exceed approved):</p>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-foreground truncate">{l.item.name}</span>
                <span className="text-xs text-muted-foreground">/ {l.approvedQty ?? 0}</span>
                <input
                  type="number"
                  min={0}
                  max={l.approvedQty ?? 0}
                  value={lineQtys[l.id] ?? 0}
                  onChange={(e) => setLineQtys((prev) => ({ ...prev, [l.id]: Math.min(l.approvedQty ?? 0, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleFulfil} disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm fulfil
            </button>
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {mode === 'cancel' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this request?</p>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleCancel} disabled={busy} className={btnDanger}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Yes, cancel
            </button>
            <button type="button" onClick={reset} disabled={busy} className={btnGhost}>Go back</button>
          </div>
        </div>
      )}
    </div>
  );
}
