'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { StockBadge } from '@/components/ui/stock-badge';
import { StockAdjuster } from '@/components/inventory/stock-adjuster';

interface ItemResult {
  id: string;
  name: string;
  currentStock: number;
  stockState: 'HEALTHY' | 'LOW' | 'OUT';
}

interface Props {
  onClose: () => void;
}

export function QuickAdjustSheet({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ItemResult | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/items?q=${encodeURIComponent(query.trim())}&limit=10`);
        if (res.ok) {
          const data = await res.json() as { data: ItemResult[] };
          setResults(data.data);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSuccess = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Quick stock adjustment"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold text-foreground">Quick adjust</h2>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!selected ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items by name…"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {loading && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>

            {/* Results */}
            {results.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.currentStock} in stock</p>
                    </div>
                    <StockBadge state={item.stockState} stock={item.currentStock} />
                  </button>
                ))}
              </div>
            ) : query.trim() && !loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No items found.</p>
            ) : null}
          </>
        ) : (
          <>
            {/* Selected item header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.currentStock} in stock</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Change item
              </button>
            </div>
            <StockAdjuster
              itemId={selected.id}
              currentStock={selected.currentStock}
              onSuccess={handleSuccess}
            />
          </>
        )}
      </div>
    </div>
  );
}
