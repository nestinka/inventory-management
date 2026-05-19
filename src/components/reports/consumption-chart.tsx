'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const PALETTE = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
];

type RawRow = {
  date: string;
  reason: string;
  totalDelta: number;
  count: number;
};

type ChartRow = {
  date: string;
  [reason: string]: number | string;
};

interface Props {
  rawData: RawRow[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function transformData(rawData: RawRow[]): { chartData: ChartRow[]; reasons: string[] } {
  const reasonSet = new Set<string>();
  for (const row of rawData) {
    reasonSet.add(row.reason);
  }
  const reasons = Array.from(reasonSet).sort();

  // Build a map keyed by date
  const byDate = new Map<string, ChartRow>();
  for (const row of rawData) {
    let entry = byDate.get(row.date);
    if (!entry) {
      entry = { date: row.date };
      byDate.set(row.date, entry);
    }
    entry[row.reason] = Math.abs(row.totalDelta);
  }

  // Sort by date ascending, fill missing reasons with 0
  const chartData = Array.from(byDate.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((entry) => {
      const filled: ChartRow = { date: entry.date };
      for (const r of reasons) {
        filled[r] = (entry[r] as number | undefined) ?? 0;
      }
      return filled;
    });

  return { chartData, reasons };
}

export function ConsumptionChart({ rawData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';

  // Convert ISO datetime param back to YYYY-MM-DD for date input display
  const fromInputValue = fromParam ? fromParam.slice(0, 10) : '';
  const toInputValue = toParam ? toParam.slice(0, 10) : '';

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // YYYY-MM-DD or ''
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('from', `${val}T00:00:00.000Z`);
    } else {
      params.delete('from');
    }
    router.push(`?${params.toString()}`);
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // YYYY-MM-DD or ''
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('to', `${val}T23:59:59.999Z`);
    } else {
      params.delete('to');
    }
    router.push(`?${params.toString()}`);
  }

  const { chartData, reasons } = transformData(rawData);

  const inputCls =
    'rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          From
          <input
            type="date"
            className={inputCls}
            value={fromInputValue}
            onChange={handleFromChange}
            aria-label="Filter from date"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          To
          <input
            type="date"
            className={inputCls}
            value={toInputValue}
            onChange={handleToChange}
            aria-label="Filter to date"
          />
        </label>
      </div>

      {/* Chart or empty state */}
      {chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-border bg-card">
          <p className="text-sm text-muted-foreground">No consumption data for this period</p>
        </div>
      ) : (
        <div
          className="h-80 rounded-xl border border-border bg-card p-4"
          aria-label="Consumption trends chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(label: string) => formatDate(label)}
              />
              <Legend />
              {reasons.map((reason, idx) => (
                <Line
                  key={reason}
                  type="monotone"
                  dataKey={reason}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
