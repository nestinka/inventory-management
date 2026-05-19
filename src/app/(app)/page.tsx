import type { Metadata } from 'next';
import { Package, AlertTriangle, XCircle, Clock, FileText, Activity } from 'lucide-react';
import { prisma } from '@/server/db/client';
import { StatCard } from '@/components/ui/stat-card';
import { env } from '@/env';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

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

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your inventory health</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Active Items"
          value={stats.totalActive}
          icon={Package}
          href="/inventory"
        />
        <StatCard
          label="Low Stock"
          value={stats.lowStock}
          icon={AlertTriangle}
          variant="warning"
          href="/inventory?stockState=LOW"
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock}
          icon={XCircle}
          variant="danger"
          href="/inventory?stockState=OUT"
        />
        <StatCard
          label="Near Expiry"
          value={stats.nearExpiry}
          icon={Clock}
          variant="warning"
          href={`/inventory?nearExpiryDays=${env.NEAR_EXPIRY_WINDOW_DAYS}`}
        />
        <StatCard
          label="Pending Requests"
          value={stats.pendingRequests}
          icon={FileText}
          href="/requests?status=PENDING"
        />
        <StatCard
          label="Audit (24h)"
          value={stats.recentAudit}
          icon={Activity}
          href="/audit"
        />
      </div>
    </div>
  );
}
