'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  Clock,
  Inbox,
  CheckCircle,
  XCircle,
  Package,
  Loader2,
} from 'lucide-react';
import { formatRelativeTime } from '../_lib/format-time';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  topic: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}

interface Props {
  notifications: Notification[];
  filter: 'all' | 'unread';
}

// ─── Topic metadata ───────────────────────────────────────────────────────────

const topicLabels: Record<string, string> = {
  'item.lowStock': 'Low stock alert',
  'item.outOfStock': 'Out of stock',
  'item.nearExpiry': 'Near expiry',
  'request.submitted': 'New request',
  'request.approved': 'Request approved',
  'request.rejected': 'Request rejected',
  'request.fulfilled': 'Request fulfilled',
};

const topicDotColors: Record<string, string> = {
  'item.lowStock': 'bg-amber-500',
  'item.outOfStock': 'bg-red-600',
  'item.nearExpiry': 'bg-orange-500',
  'request.submitted': 'bg-blue-500',
  'request.approved': 'bg-emerald-500',
  'request.rejected': 'bg-rose-500',
  'request.fulfilled': 'bg-teal-500',
};

const topicLabelColors: Record<string, string> = {
  'item.lowStock': 'text-amber-600',
  'item.outOfStock': 'text-red-600',
  'item.nearExpiry': 'text-orange-600',
  'request.submitted': 'text-blue-600',
  'request.approved': 'text-emerald-600',
  'request.rejected': 'text-rose-600',
  'request.fulfilled': 'text-teal-600',
};

function TopicIcon({ topic, className }: { topic: string; className?: string }) {
  const cls = className ?? 'h-4 w-4';
  switch (topic) {
    case 'item.lowStock':
      return <AlertTriangle className={cls} />;
    case 'item.outOfStock':
      return <AlertTriangle className={cls} />;
    case 'item.nearExpiry':
      return <Clock className={cls} />;
    case 'request.submitted':
      return <Inbox className={cls} />;
    case 'request.approved':
      return <CheckCircle className={cls} />;
    case 'request.rejected':
      return <XCircle className={cls} />;
    case 'request.fulfilled':
      return <Package className={cls} />;
    default:
      return <Bell className={cls} />;
  }
}

// ─── Payload description ──────────────────────────────────────────────────────

function payloadDescription(topic: string, payload: unknown): React.ReactNode {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (topic === 'item.outOfStock') {
    const name = String(p.name ?? 'Unknown item');
    return (
      <>
        <strong>{name}</strong> is completely out of stock
      </>
    );
  }
  if (topic === 'item.lowStock') {
    const name = String(p.name ?? 'Unknown item');
    const currentStock = p.currentStock ?? 0;
    const threshold = p.threshold ?? 0;
    return (
      <>
        <strong>{name}</strong> is below threshold ({String(currentStock)} remaining, threshold:{' '}
        {String(threshold)})
      </>
    );
  }
  if (topic === 'item.nearExpiry') {
    const name = String(p.name ?? 'Unknown item');
    const expiryDate = p.expiryDate
      ? new Date(p.expiryDate as string).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : null;
    return (
      <>
        <strong>{name}</strong> is expiring{expiryDate ? ` on ${expiryDate}` : ' soon'}
      </>
    );
  }
  if (topic.startsWith('request.')) {
    const requestId = String(p.requestId ?? '');
    const short = requestId.slice(0, 8);
    const detail =
      topic === 'request.submitted'
        ? ' — awaiting approval'
        : topic === 'request.approved'
          ? ' — has been approved'
          : topic === 'request.rejected'
            ? ' — has been rejected'
            : topic === 'request.fulfilled'
              ? ' — has been fulfilled'
              : '';
    return (
      <>
        Request <strong>#{short}</strong>
        {detail}
      </>
    );
  }
  return null;
}

// ─── View link ────────────────────────────────────────────────────────────────

function viewHref(topic: string, payload: unknown): string | null {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (topic === 'item.lowStock' || topic === 'item.outOfStock' || topic === 'item.nearExpiry') {
    const itemId = String(p.itemId ?? '');
    return itemId ? `/inventory/${itemId}` : null;
  }
  if (topic.startsWith('request.')) {
    const requestId = String(p.requestId ?? '');
    return requestId ? `/requests/${requestId}` : null;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationsPage({ notifications: initial, filter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [markingAll, startMarkingAll] = useTransition();
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());

  const displayed =
    filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // ── Mark single read ──────────────────────────────────────────────────────

  async function markOneRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
    );
    setMarkingIds((prev) => new Set(prev).add(id));

    try {
      await fetch(`/api/v1/notifications/${id}`, { method: 'PATCH' });
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // ── Mark all read ─────────────────────────────────────────────────────────

  function markAllRead() {
    startMarkingAll(async () => {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
      await fetch('/api/v1/notifications', { method: 'POST' });
      router.refresh();
    });
  }

  // ── Filter tabs ───────────────────────────────────────────────────────────

  function filterHref(value: 'all' | 'unread') {
    const params = new URLSearchParams();
    if (value === 'unread') params.set('filter', 'unread');
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
                unread
              </span>
            ) : (
              'All caught up'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0 || markingAll}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {markingAll && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Mark all as read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {(['all', 'unread'] as const).map((tab) => (
          <Link
            key={tab}
            href={filterHref(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : 'Unread'}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Notification list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center shadow-sm">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-base font-medium text-foreground">All caught up!</p>
          <p className="mt-1 text-sm text-muted-foreground">No notifications{filter === 'unread' ? ' to read' : ''}.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
          {displayed.map((n) => {
            const isUnread = !n.readAt;
            const href = viewHref(n.topic, n.payload);
            const isMarkingThis = markingIds.has(n.id);

            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  isUnread ? 'border-l-2 border-l-primary bg-primary/5' : ''
                }`}
              >
                {/* Icon */}
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    topicDotColors[n.topic]
                      ? `${topicDotColors[n.topic]}/10`
                      : 'bg-muted'
                  }`}
                >
                  <span className={topicLabelColors[n.topic] ?? 'text-foreground'}>
                    <TopicIcon topic={n.topic} className="h-4 w-4" />
                  </span>
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        topicLabelColors[n.topic] ?? 'text-foreground'
                      }`}
                    >
                      {topicLabels[n.topic] ?? n.topic}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(new Date(n.createdAt))}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-foreground">
                    {payloadDescription(n.topic, n.payload)}
                  </p>

                  {/* Actions */}
                  <div className="mt-2 flex items-center gap-3">
                    {href && (
                      <Link
                        href={href}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View →
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markOneRead(n.id)}
                        disabled={isMarkingThis}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        {isMarkingThis && <Loader2 className="h-3 w-3 animate-spin" />}
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
