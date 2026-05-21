'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, Loader2, Sparkles } from 'lucide-react';
import { StockBadge } from '@/components/ui/stock-badge';

interface ItemResult {
  id: string;
  name: string;
  currentStock: number;
  stockState: 'HEALTHY' | 'LOW' | 'OUT';
  unitOfMeasure: string;
}

interface Category {
  id: string;
  name: string;
}

const lineSchema = z
  .object({
    mode: z.enum(['existing', 'new']),
    itemId: z.string(),
    itemLabel: z.string(),
    newName: z.string(),
    newUnit: z.string(),
    newCategoryId: z.string(),
    requestedQty: z.coerce.number().int().min(1, 'Min 1'),
  })
  .superRefine((l, ctx) => {
    if (l.mode === 'existing') {
      if (!l.itemId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['itemId'], message: 'Select an item' });
    } else {
      if (!l.newName.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newName'], message: 'Item name is required' });
      if (!l.newUnit.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newUnit'], message: 'Unit is required' });
      if (!l.newCategoryId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newCategoryId'], message: 'Category is required' });
    }
  });

const formSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  lines: z.array(lineSchema).min(1, 'Add at least one line'),
});

type FormValues = z.infer<typeof formSchema>;
type LineValue = FormValues['lines'][number];

const emptyLine: LineValue = {
  mode: 'existing',
  itemId: '',
  itemLabel: '',
  newName: '',
  newUnit: '',
  newCategoryId: '',
  requestedQty: 1,
};

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ItemPicker({ value, onChange, onBlur, onCreateNew }: {
  value: { itemId: string; itemLabel: string };
  onChange: (v: { itemId: string; itemLabel: string }) => void;
  onBlur: () => void;
  onCreateNew: (name: string) => void;
}) {
  const [query, setQuery] = useState(value.itemLabel || '');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/items?q=${encodeURIComponent(q.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json() as { data: ItemResult[] };
          setResults(data.data);
          setOpen(true);
        }
      } finally { setLoading(false); }
    }, 250);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); onBlur();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onBlur]);

  const select = (item: ItemResult) => {
    onChange({ itemId: item.id, itemLabel: item.name });
    setQuery(item.name);
    setOpen(false); setResults([]);
  };

  const trimmed = query.trim();

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); onChange({ itemId: '', itemLabel: e.target.value }); }}
          onFocus={() => { if (trimmed) setOpen(true); }}
          placeholder="Search item…"
          className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoComplete="off"
        />
        {loading && <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && trimmed.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {results.map((item) => (
            <button key={item.id} type="button" onMouseDown={() => select(item)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted transition-colors">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.unitOfMeasure}</span>
              </span>
              <StockBadge state={item.stockState} stock={item.currentStock} />
            </button>
          ))}
          <button type="button" onMouseDown={() => { setOpen(false); onCreateNew(trimmed); }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-muted transition-colors">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Request <span className="font-medium">“{trimmed}”</span> as a new item</span>
          </button>
        </div>
      )}
    </div>
  );
}

function NewItemFields({ value, categories, onChange, onSearchInstead }: {
  value: LineValue;
  categories: Category[];
  onChange: (v: Partial<LineValue>) => void;
  onSearchInstead: () => void;
}) {
  return (
    <div className="flex-1 space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> New item (not in catalogue)
        </span>
        <button type="button" onClick={onSearchInstead}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Search existing instead
        </button>
      </div>
      <input
        type="text" value={value.newName} onChange={(e) => onChange({ newName: e.target.value })}
        placeholder="Item name" aria-label="New item name" className={inputCls} autoComplete="off"
      />
      <div className="flex gap-2">
        <input
          type="text" value={value.newUnit} onChange={(e) => onChange({ newUnit: e.target.value })}
          placeholder="Unit (e.g. pcs)" aria-label="Unit of measure" className={`${inputCls} flex-1`} autoComplete="off"
        />
        <select
          value={value.newCategoryId} onChange={(e) => onChange({ newCategoryId: e.target.value })}
          aria-label="Category" className={`${inputCls} flex-1`}
        >
          <option value="">Category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">An admin will add this to the catalogue when approving the request.</p>
    </div>
  );
}

export function NewRequestForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/categories?limit=100&status=ACTIVE')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d: { data: Category[] }) => { if (active) setCategories(d.data ?? []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: '', lines: [{ ...emptyLine }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const res = await fetch('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: values.reason,
        lines: values.lines.map((l) =>
          l.mode === 'existing'
            ? { itemId: l.itemId, requestedQty: l.requestedQty }
            : {
                newItem: { name: l.newName.trim(), unitOfMeasure: l.newUnit.trim(), categoryId: l.newCategoryId },
                requestedQty: l.requestedQty,
              },
        ),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setServerError(data.message ?? 'Failed to submit request');
      return;
    }
    router.push('/requests');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Reason <span className="text-destructive">*</span>
        </label>
        <textarea {...register('reason')} rows={3} maxLength={500}
          placeholder="Why do you need these items?" className={inputCls} />
        {errors.reason && <p className="mt-1 text-xs text-destructive">{errors.reason.message}</p>}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Lines <span className="text-destructive">*</span>
          </label>
          <button type="button" onClick={() => append({ ...emptyLine })}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex gap-2">
                <Controller control={control} name={`lines.${index}`}
                  render={({ field: f }) => (
                    f.value.mode === 'new' ? (
                      <NewItemFields
                        value={f.value}
                        categories={categories}
                        onChange={(v) => f.onChange({ ...f.value, ...v })}
                        onSearchInstead={() => f.onChange({ ...f.value, mode: 'existing', newName: '', newUnit: '', newCategoryId: '' })}
                      />
                    ) : (
                      <ItemPicker
                        value={{ itemId: f.value.itemId, itemLabel: f.value.itemLabel }}
                        onChange={(v) => f.onChange({ ...f.value, ...v })}
                        onBlur={f.onBlur}
                        onCreateNew={(name) => f.onChange({ ...f.value, mode: 'new', itemId: '', itemLabel: '', newName: name })}
                      />
                    )
                  )}
                />
                <input type="number" min={1} {...register(`lines.${index}.requestedQty`)}
                  className="h-9 w-20 shrink-0 rounded-lg border border-input bg-background px-2 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Quantity" />
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                    aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {errors.lines?.[index] && (
                <p className="mt-1.5 text-xs text-destructive">
                  {errors.lines[index]?.itemId?.message
                    ?? errors.lines[index]?.newName?.message
                    ?? errors.lines[index]?.newUnit?.message
                    ?? errors.lines[index]?.newCategoryId?.message
                    ?? errors.lines[index]?.requestedQty?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        {errors.lines?.root && <p className="mt-1 text-xs text-destructive">{errors.lines.root.message}</p>}
      </div>

      {serverError && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit request
        </button>
        <button
          type="button"
          onClick={() => router.push('/requests')}
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
