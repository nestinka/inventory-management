'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

interface Props {
  itemId: string;
  itemName: string;
}

export function DeleteItemButton({ itemId, itemName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete item "${itemName}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/v1/items/${itemId}`, { method: 'DELETE' });
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
      title="Delete item"
      aria-label={`Delete ${itemName}`}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors disabled:opacity-60"
    >
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5" />
      }
    </button>
  );
}
