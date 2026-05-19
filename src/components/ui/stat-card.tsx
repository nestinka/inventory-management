import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'warning' | 'danger';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant?: Variant;
  href?: string;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-rose-100  text-rose-700',
};

export function StatCard({ label, value, icon: Icon, variant = 'default', href }: StatCardProps) {
  const content = (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', variantStyles[variant])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href} aria-label={`${label}: ${value}`}>{content}</Link> : <div>{content}</div>;
}
