'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Props {
  categoryId: string;
  categoryName: string;
  currentStatus: 'ACTIVE' | 'INACTIVE';
}

export function CategoryStatusButton({ categoryId, categoryName, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isActive = currentStatus === 'ACTIVE';
  const label = isActive ? 'Deactivate' : 'Activate';
  const confirmMsg = isActive
    ? `Deactivate "${categoryName}"? It will no longer be available for new items.`
    : `Activate "${categoryName}"?`;

  const toggle = async () => {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fetch(`/api/v1/categories/${categoryId}`, {
      method: isActive ? 'DELETE' : 'POST',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      alert(data.message ?? 'Action failed');
    } else {
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1 text-xs hover:underline disabled:opacity-60 ${
        isActive ? 'text-red-700' : 'text-emerald-700'
      }`}
    >
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </button>
  );
}
