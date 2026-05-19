import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, TrendingDown, Package, Clock, FileText, ArrowLeftRight, CalendarDays, ClipboardList } from 'lucide-react';

export const metadata: Metadata = { title: 'Reports' };

const REPORTS = [
  {
    title: 'Current Inventory',
    description: 'Full snapshot of all active items and stock levels',
    href: '/reports/inventory',
    icon: Package,
  },
  {
    title: 'Low Stock',
    description: 'Items at or below their reorder threshold',
    href: '/reports/low-stock',
    icon: TrendingDown,
  },
  {
    title: 'Consumption Trends',
    description: 'Stock adjustments over time by reason and actor',
    href: '/reports/consumption',
    icon: BarChart3,
  },
  {
    title: 'Near Expiry',
    description: 'Items expiring within a configurable window',
    href: '/reports/near-expiry',
    icon: Clock,
  },
  {
    title: 'Stock Movements',
    description: 'All additions and removals within a date range, with net movement summary',
    href: '/reports/stock-movements',
    icon: ArrowLeftRight,
  },
  {
    title: 'Monthly Usage',
    description: 'Item consumption patterns grouped by month with top-item rankings',
    href: '/reports/monthly-usage',
    icon: CalendarDays,
  },
  {
    title: 'Request Summary',
    description: 'All requests in a date range with quantities, status, and approver detail',
    href: '/reports/request-summary',
    icon: ClipboardList,
  },
  {
    title: 'Request Analytics',
    description: 'Approval rates, response times, and fulfilment volumes',
    href: '/reports/request-analytics',
    icon: FileText,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live data grids with date-range filtering
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <r.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">{r.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
