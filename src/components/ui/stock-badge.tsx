import { cn } from '@/lib/utils';
import type { StockState } from '@/server/modules/items';

interface StockBadgeProps {
  state: StockState;
  stock: number;
  className?: string;
}

const styles: Record<StockState, string> = {
  HEALTHY: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  LOW:     'bg-amber-50  text-amber-700  ring-amber-200',
  OUT:     'bg-rose-50   text-rose-700   ring-rose-200',
};

const labels: Record<StockState, string> = {
  HEALTHY: 'Healthy',
  LOW:     'Low',
  OUT:     'Out',
};

export function StockBadge({ state, stock, className }: StockBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[state],
        className,
      )}
      aria-label={`${labels[state]} stock: ${stock}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-emerald-500': state === 'HEALTHY',
        'bg-amber-500':   state === 'LOW',
        'bg-rose-500':    state === 'OUT',
      })} aria-hidden="true" />
      {stock}
      <span className="sr-only">({labels[state]})</span>
    </span>
  );
}
