'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

interface SidebarProps {
  className?: string;
  role?: string;
  defaultCollapsed?: boolean;
}

export function Sidebar({ className, role, defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // Persist so the server renders the same width on the next request.
    document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role as 'ADMIN' | 'EDITOR' | 'VIEWER')),
  );

  return (
    <aside
      className={cn(
        'flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          'flex h-14 items-center gap-2.5 border-b border-border',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            title="Expand sidebar"
            className="group flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="group-hover:hidden">IN</span>
            <ChevronsRight className="hidden h-4 w-4 group-hover:block" aria-hidden="true" />
          </button>
        ) : (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              IN
            </span>
            <span className="font-semibold text-foreground">Inventory</span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded={true}
              title="Collapse sidebar"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg py-2 text-sm transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    active
                      ? 'bg-accent font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
