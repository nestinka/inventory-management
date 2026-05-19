'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, FileText, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickAdjustSheet } from '@/components/inventory/quick-adjust-sheet';

const LEFT_TABS = [
  { label: 'Dashboard', href: '/',           icon: LayoutDashboard },
  { label: 'Inventory',  href: '/inventory', icon: Package },
];

const RIGHT_TABS = [
  { label: 'Requests',   href: '/requests',  icon: FileText },
  { label: 'More',       href: '/reports',   icon: MoreHorizontal },
];

interface Props { className?: string }

export function BottomTabBar({ className }: Props) {
  const pathname = usePathname();
  const [showSheet, setShowSheet] = useState(false);

  const renderTab = (tab: { label: string; href: string; icon: React.ElementType }) => {
    const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <tab.icon className="h-5 w-5" aria-hidden="true" />
        {tab.label}
      </Link>
    );
  };

  return (
    <>
      {showSheet && <QuickAdjustSheet onClose={() => setShowSheet(false)} />}
      <nav
        className={cn('fixed bottom-0 inset-x-0 z-40 flex items-end border-t border-border bg-card', className)}
        aria-label="Mobile navigation"
      >
        {LEFT_TABS.map(renderTab)}

        {/* Center FAB */}
        <div className="flex shrink-0 flex-col items-center pb-2">
          <button
            type="button"
            onClick={() => setShowSheet(true)}
            aria-label="Quick stock adjustment"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </button>
          <span className="mt-1 text-xs text-muted-foreground">Adjust</span>
        </div>

        {RIGHT_TABS.map(renderTab)}
      </nav>
    </>
  );
}
