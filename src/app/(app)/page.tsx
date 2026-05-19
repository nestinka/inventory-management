import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Package, AlertTriangle, XCircle, Clock, FileText, Activity,
  ClipboardList, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { prisma } from '@/server/db/client';
import { StatCard } from '@/components/ui/stat-card';
import { env } from '@/env';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const nearExpiryDate = new Date(Date.now() + env.NEAR_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalActive, outOfStock, nearExpiry, pendingRequests, recentAudit, lowStockRows] = await Promise.all([
    prisma.item.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.item.count({ where: { status: 'ACTIVE', deletedAt: null, currentStock: { lte: 0 } } }),
    prisma.item.count({ where: { deletedAt: null, expiryDate: { lte: nearExpiryDate, gte: now } } }),
    prisma.request.count({ where: { status: 'PENDING' } }),
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM items
      WHERE status = 'ACTIVE' AND deleted_at IS NULL
        AND current_stock > 0 AND current_stock <= reorder_threshold
    `,
  ]);
  const lowStock = Number(lowStockRows[0]?.count ?? 0);
  return { totalActive, lowStock, outOfStock, nearExpiry, pendingRequests, recentAudit };
}

async function getAttentionItems() {
  const nearExpiryDate = new Date(Date.now() + env.NEAR_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [pendingRequests, outOfStockItems, nearExpiryItems, lowStockRaw] = await Promise.all([
    prisma.request.findMany({
      where: { status: 'PENDING' },
      include: {
        requester: { select: { name: true } },
        lines: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    prisma.item.findMany({
      where: { status: 'ACTIVE', deletedAt: null, currentStock: { lte: 0 } },
      select: { id: true, name: true, reorderThreshold: true },
      orderBy: { name: 'asc' },
      take: 5,
    }),
    prisma.item.findMany({
      where: { deletedAt: null, expiryDate: { lte: nearExpiryDate, gte: now } },
      select: { id: true, name: true, expiryDate: true, currentStock: true },
      orderBy: { expiryDate: 'asc' },
      take: 5,
    }),
    // Low-stock requires cross-column compare — raw SQL
    prisma.$queryRaw<Array<{ id: string; name: string; current_stock: number; reorder_threshold: number }>>`
      SELECT id::text, name, current_stock, reorder_threshold
      FROM items
      WHERE status = 'ACTIVE' AND deleted_at IS NULL
        AND current_stock > 0 AND current_stock <= reorder_threshold
      ORDER BY (current_stock::float / GREATEST(reorder_threshold, 1)) ASC
      LIMIT 5
    `,
  ]);

  const lowStockItems = lowStockRaw.map((i) => ({
    id: i.id,
    name: i.name,
    currentStock: Number(i.current_stock),
    reorderThreshold: Number(i.reorder_threshold),
  }));

  return { pendingRequests, outOfStockItems, nearExpiryItems, lowStockItems };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelHeader({
  icon: Icon,
  iconCls,
  title,
  count,
  countVariant,
}: {
  icon: React.ElementType;
  iconCls: string;
  title: string;
  count: number;
  countVariant: 'amber' | 'red' | 'orange' | 'blue';
}) {
  const badgeCls = {
    amber:  'bg-amber-100  text-amber-700',
    red:    'bg-rose-100   text-rose-700',
    orange: 'bg-orange-100 text-orange-700',
    blue:   'bg-blue-100   text-blue-700',
  }[countVariant];

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      {count > 0 && (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeCls}`}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function PanelFooter({ href, label }: { href: string; label: string }) {
  return (
    <div className="border-t border-border px-5 py-2.5">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [stats, attention] = await Promise.all([
    getDashboardStats(),
    getAttentionItems(),
  ]);

  const totalNeedingAttention =
    attention.pendingRequests.length +
    attention.outOfStockItems.length +
    attention.nearExpiryItems.length +
    attention.lowStockItems.length;

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your inventory health</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Items"      value={stats.totalActive}      icon={Package}   href="/inventory" />
        <StatCard label="Low Stock"         value={stats.lowStock}         icon={AlertTriangle} variant="warning" href="/inventory?stockState=LOW" />
        <StatCard label="Out of Stock"      value={stats.outOfStock}       icon={XCircle}   variant="danger"  href="/inventory?stockState=OUT" />
        <StatCard label="Near Expiry"       value={stats.nearExpiry}       icon={Clock}     variant="warning" href={`/inventory?nearExpiryDays=${env.NEAR_EXPIRY_WINDOW_DAYS}`} />
        <StatCard label="Pending Requests"  value={stats.pendingRequests}  icon={FileText}  href="/requests?status=PENDING" />
        <StatCard label="Audit (24h)"       value={stats.recentAudit}      icon={Activity}  href="/audit" />
      </div>

      {/* ── Attention needed ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Needs Attention
          </h2>
          {totalNeedingAttention > 0 ? (
            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              {totalNeedingAttention}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              All clear
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* ─ Pending Requests ─ */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <PanelHeader
              icon={ClipboardList}
              iconCls="bg-blue-500/10 text-blue-600"
              title="Pending Approval"
              count={attention.pendingRequests.length}
              countVariant="blue"
            />
            {attention.pendingRequests.length === 0 ? (
              <EmptyState label="No requests awaiting approval" />
            ) : (
              <ul className="divide-y divide-border">
                {attention.pendingRequests.map((req) => (
                  <li key={req.id}>
                    <Link
                      href={`/requests/${req.id}`}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {req.requester.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.lines.length} line{req.lines.length !== 1 ? 's' : ''} · #{req.id.slice(0, 8)}
                        </p>
                      </div>
                      <span className="ml-3 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        pending
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <PanelFooter href="/requests?status=PENDING" label="View all requests" />
          </div>

          {/* ─ Out of Stock ─ */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <PanelHeader
              icon={XCircle}
              iconCls="bg-rose-500/10 text-rose-600"
              title="Out of Stock"
              count={attention.outOfStockItems.length}
              countVariant="red"
            />
            {attention.outOfStockItems.length === 0 ? (
              <EmptyState label="No items are out of stock" />
            ) : (
              <ul className="divide-y divide-border">
                {attention.outOfStockItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Reorder at {item.reorderThreshold}
                        </p>
                      </div>
                      <span className="ml-3 shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        0 in stock
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <PanelFooter href="/inventory/quick-update" label="Go to Quick Stock Update" />
          </div>

          {/* ─ Low Stock ─ */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <PanelHeader
              icon={AlertTriangle}
              iconCls="bg-amber-500/10 text-amber-600"
              title="Low Stock"
              count={attention.lowStockItems.length}
              countVariant="amber"
            />
            {attention.lowStockItems.length === 0 ? (
              <EmptyState label="All items are above threshold" />
            ) : (
              <ul className="divide-y divide-border">
                {attention.lowStockItems.map((item) => {
                  const pct = item.reorderThreshold > 0
                    ? Math.round((item.currentStock / item.reorderThreshold) * 100)
                    : null;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/inventory/${item.id}`}
                        className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            {/* Slim progress bar */}
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${Math.min(pct ?? 50, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {item.currentStock} / {item.reorderThreshold}
                            </span>
                          </div>
                        </div>
                        {pct !== null && (
                          <span className="ml-auto shrink-0 text-xs font-semibold text-amber-700">
                            {pct}%
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <PanelFooter href="/inventory/quick-update" label="Quick Stock Update" />
          </div>

          {/* ─ Near Expiry ─ */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <PanelHeader
              icon={Clock}
              iconCls="bg-orange-500/10 text-orange-600"
              title={`Expiring Within ${env.NEAR_EXPIRY_WINDOW_DAYS} Days`}
              count={attention.nearExpiryItems.length}
              countVariant="orange"
            />
            {attention.nearExpiryItems.length === 0 ? (
              <EmptyState label={`Nothing expiring in the next ${env.NEAR_EXPIRY_WINDOW_DAYS} days`} />
            ) : (
              <ul className="divide-y divide-border">
                {attention.nearExpiryItems.map((item) => {
                  const daysLeft = item.expiryDate
                    ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const urgentCls = daysLeft !== null && daysLeft <= 7
                    ? 'text-rose-700 font-semibold'
                    : 'text-orange-700';
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/inventory/${item.id}`}
                        className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.currentStock} in stock
                          </p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <p className={`text-xs ${urgentCls}`}>
                            {item.expiryDate ? formatDate(item.expiryDate) : '—'}
                          </p>
                          {daysLeft !== null && (
                            <p className={`text-[11px] ${urgentCls}`}>
                              {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <PanelFooter href="/reports/near-expiry" label="View expiry report" />
          </div>

        </div>
      </section>

    </div>
  );
}
