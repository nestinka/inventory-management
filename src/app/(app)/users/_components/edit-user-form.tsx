'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { UserRole } from '@/server/modules/users';

type UserData = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type Props = {
  user: UserData;
};

export function EditUserForm({ user }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name,
    role: user.role as string,
    isActive: user.isActive,
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          isActive: form.isActive,
        }),
      });

      const data = await res.json() as {
        id?: string;
        error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      };

      if (!res.ok) {
        if (data.error?.details?.fieldErrors) {
          setFieldErrors(data.error.details.fieldErrors);
        }
        throw new Error(data.error?.message ?? 'Failed to update user');
      }

      router.push('/users');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Email</label>
        <input
          type="email"
          value={user.email}
          readOnly
          className="h-9 w-full cursor-not-allowed rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground"
        />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={handleChange}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {fieldErrors.name?.map((msg) => (
          <p key={msg} className="text-xs text-red-600">{msg}</p>
        ))}
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <label htmlFor="role" className="block text-sm font-medium text-foreground">
          Role
        </label>
        <select
          id="role"
          name="role"
          value={form.role}
          onChange={handleChange}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ADMIN">Admin</option>
          <option value="EDITOR">Editor</option>
          <option value="VIEWER">Viewer</option>
        </select>
        {fieldErrors.role?.map((msg) => (
          <p key={msg} className="text-xs text-red-600">{msg}</p>
        ))}
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-foreground">
          Active
        </label>
        {fieldErrors.isActive?.map((msg) => (
          <p key={msg} className="text-xs text-red-600">{msg}</p>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <Link
          href="/users"
          className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
