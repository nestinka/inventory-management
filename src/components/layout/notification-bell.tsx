'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Notification {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const topicLabels: Record<string, string> = {
  'item.lowStock':       'Low stock alert',
  'item.nearExpiry':     'Near expiry',
  'request.submitted':  'New request',
  'request.approved':   'Request approved',
  'request.rejected':   'Request rejected',
  'request.fulfilled':  'Request fulfilled',
};

const topicColors: Record<string, string> = {
  'item.lowStock':       'text-amber-600',
  'item.nearExpiry':     'text-orange-600',
  'request.submitted':  'text-blue-600',
  'request.approved':   'text-emerald-600',
  'request.rejected':   'text-rose-600',
  'request.fulfilled':  'text-blue-700',
};

function payloadSummary(topic: string, payload: Record<string, unknown>): string {
  if (topic === 'item.lowStock' || topic === 'item.nearExpiry') {
    return String(payload.name ?? payload.itemId ?? '');
  }
  if (topic.startsWith('request.')) {
    return `Request ${String(payload.requestId ?? '').slice(0, 8)}`;
  }
  return '';
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/notifications');
      if (res.ok) setNotifications(await res.json() as Notification[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30s when open, fetch once on mount
  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [open, fetch_]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    setMarking(true);
    await fetch('/api/v1/notifications', { method: 'POST' });
    setMarking(false);
    await fetch_();
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) fetch_(); }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={marking}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {marking && <Loader2 className="h-3 w-3 animate-spin" />}
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 transition-colors ${n.readAt ? '' : 'bg-primary/5'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    )}
                    <div className={n.readAt ? 'ml-3.5' : ''}>
                      <p className={`text-xs font-semibold ${topicColors[n.topic] ?? 'text-foreground'}`}>
                        {topicLabels[n.topic] ?? n.topic}
                      </p>
                      {payloadSummary(n.topic, n.payload) && (
                        <p className="text-sm text-foreground">{payloadSummary(n.topic, n.payload)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDateTime(new Date(n.createdAt))}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
