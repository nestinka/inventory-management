import {
  LayoutDashboard, Package, Zap, Tag, Layers, FileText, ClipboardList, Users, BarChart3, Bell, Settings, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: ('ADMIN' | 'EDITOR' | 'VIEWER')[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   href: '/',                          icon: LayoutDashboard },
  { label: 'Inventory',   href: '/inventory',                 icon: Package },
  { label: 'Quick Update', href: '/inventory/quick-update',   icon: Zap,         roles: ['ADMIN', 'EDITOR'] },
  { label: 'Categories',  href: '/catalogue/categories',      icon: Tag,         roles: ['ADMIN'] },
  { label: 'Items',       href: '/catalogue/items',           icon: Layers,      roles: ['ADMIN', 'EDITOR'] },
  { label: 'Requests',    href: '/requests',                  icon: FileText },
  { label: 'Notifications', href: '/notifications',            icon: Bell },
  { label: 'Audit Log',   href: '/audit',                     icon: ClipboardList, roles: ['ADMIN', 'EDITOR'] },
  { label: 'Reports',     href: '/reports',                   icon: BarChart3,    roles: ['ADMIN', 'EDITOR'] },
  { label: 'Users',       href: '/users',                     icon: Users,       roles: ['ADMIN'] },
  { label: 'Settings',    href: '/settings',                  icon: Settings,    roles: ['ADMIN'] },
  { label: 'Help',        href: '/help',                      icon: HelpCircle },
];
