'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Props {
  categoryId: string;
  categoryName: string;
}

export function DeleteCategoryButton({ categoryId, categoryName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete category "${categoryName}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/v1/categories/${categoryId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      alert(data.message ?? 'Delete failed');
    } else {
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      Delete
    </button>
  );
}
