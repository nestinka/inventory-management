'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

const STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'DISCONTINUED'] as const;

const baseSchema = z.object({
  name: z.string().min(1, 'Required').max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  unitOfMeasure: z.string().min(1, 'Required').max(50).trim(),
  categoryId: z.string().min(1, 'Required'),
  reorderThreshold: z.coerce.number().int().min(0).default(0),
  expiryDate: z.string().optional(),
  status: z.enum(STATUS_VALUES),
});

const createSchema = baseSchema.extend({
  currentStock: z.coerce.number().int().min(0).default(0),
});

const editSchema = baseSchema;

type CreateValues = z.infer<typeof createSchema>;
type _EditValues = z.infer<typeof editSchema>;
type FormValues = CreateValues;

interface Category { id: string; name: string }

interface Props {
  itemId?: string;
  defaultValues?: Partial<FormValues>;
  categories: Category[];
}

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ItemForm({ itemId, defaultValues, categories }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(itemId);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      status: 'ACTIVE',
      currentStock: 0,
      reorderThreshold: 0,
      ...defaultValues,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const url = itemId ? `/api/v1/items/${itemId}` : '/api/v1/items';
    // On edit, strip currentStock — it's server-immutable after creation
    const body: Partial<FormValues> = isEdit
      ? (({ currentStock: _c, ...rest }: FormValues) => rest)(values as FormValues & { currentStock: number })
      : values;

    const res = await fetch(url, {
      method: itemId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      setServerError(data.message ?? 'Something went wrong');
      return;
    }
    router.push('/catalogue/items');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Name */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <input {...register('name')} className={inputCls} placeholder="e.g. HP EliteBook 840" autoFocus />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Unit of measure */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Unit of measure <span className="text-destructive">*</span>
          </label>
          <input {...register('unitOfMeasure')} className={inputCls} placeholder="each, box, pack…" />
          {errors.unitOfMeasure && <p className="mt-1 text-xs text-destructive">{errors.unitOfMeasure.message}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Category <span className="text-destructive">*</span>
          </label>
          <select {...register('categoryId')} className={inputCls}>
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId.message}</p>}
        </div>

        {/* Status */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Status</label>
          <select {...register('status')} className={inputCls}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>

        {/* Opening stock — create only */}
        {!isEdit && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Opening stock</label>
            <input
              type="number"
              min={0}
              {...register('currentStock' as keyof FormValues)}
              className={inputCls}
            />
            {'currentStock' in errors && errors.currentStock && (
              <p className="mt-1 text-xs text-destructive">
                {(errors.currentStock as { message?: string }).message}
              </p>
            )}
          </div>
        )}

        {/* Reorder threshold */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Reorder threshold</label>
          <input type="number" min={0} {...register('reorderThreshold')} className={inputCls} />
          {errors.reorderThreshold && <p className="mt-1 text-xs text-destructive">{errors.reorderThreshold.message}</p>}
        </div>

        {/* Expiry date */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Expiry date</label>
          <input type="date" {...register('expiryDate')} className={inputCls} />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
          <textarea {...register('description')} rows={2} className={inputCls} placeholder="Optional" />
          {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
        </div>
      </div>

      {serverError && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {itemId ? 'Save changes' : 'Create item'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/catalogue/items')}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
