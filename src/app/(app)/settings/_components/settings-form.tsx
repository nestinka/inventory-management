'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

type Initial = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordSet: boolean;
  mailFrom: string;
  alertRecipients: string[];
  updatedAt: Date | string | null;
};

type FormState = {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  // Password input is starts empty. Empty + smtpPasswordSet=true means "leave existing".
  smtpPassword: string;
  // Toggled by checkbox so the user can deliberately clear a stored password.
  clearPassword: boolean;
  mailFrom: string;
};

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const labelCls = 'block text-sm font-medium text-foreground';

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    smtpHost: initial.smtpHost,
    smtpPort: String(initial.smtpPort),
    smtpSecure: initial.smtpSecure,
    smtpUser: initial.smtpUser ?? '',
    smtpPassword: '',
    clearPassword: false,
    mailFrom: initial.mailFrom,
  });
  const [recipients, setRecipients] = useState<string[]>(initial.alertRecipients);
  const [recipientDraft, setRecipientDraft] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function tryAddRecipient(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (recipients.includes(email)) {
      setRecipientDraft('');
      return;
    }
    // Permissive client-side check — the server is the source of truth.
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldErrors((p) => ({ ...p, alertRecipients: [`"${email}" is not a valid email`] }));
      return;
    }
    setFieldErrors((p) => ({ ...p, alertRecipients: [] }));
    setRecipients((prev) => [...prev, email]);
    setRecipientDraft('');
  }

  function handleRecipientKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      tryAddRecipient(recipientDraft);
    } else if (e.key === 'Backspace' && recipientDraft === '' && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((e) => e !== email));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Flush an unsubmitted recipient draft so it doesn't silently drop.
    let finalRecipients = recipients;
    if (recipientDraft.trim()) {
      const email = recipientDraft.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setFieldErrors({ alertRecipients: [`"${email}" is not a valid email`] });
        return;
      }
      if (!finalRecipients.includes(email)) finalRecipients = [...finalRecipients, email];
      setRecipientDraft('');
      setRecipients(finalRecipients);
    }

    setSubmitting(true);
    try {
      // smtpPassword semantics:
      //   - clearPassword → null  (server sets stored password to NULL)
      //   - non-empty input → new password
      //   - empty + not clearing → omit (server keeps existing)
      const passwordField: { smtpPassword?: string | null } = form.clearPassword
        ? { smtpPassword: null }
        : form.smtpPassword
          ? { smtpPassword: form.smtpPassword }
          : {};

      const res = await fetch('/api/v1/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser || null,
          mailFrom: form.mailFrom,
          alertRecipients: finalRecipients,
          ...passwordField,
        }),
      });

      const data = (await res.json()) as {
        error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      };

      if (!res.ok) {
        if (data.error?.details?.fieldErrors) setFieldErrors(data.error.details.fieldErrors);
        throw new Error(data.error?.message ?? 'Failed to save settings');
      }

      setSavedAt(new Date());
      setForm((p) => ({ ...p, smtpPassword: '', clearPassword: false }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSubmitting(false);
    }
  }

  const passwordSet = initial.smtpPasswordSet;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Saved at {savedAt.toLocaleTimeString()}
        </div>
      )}

      {/* ── SMTP ────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">SMTP server</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Outgoing mail credentials. The previous connection is dropped when settings save.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="smtpHost" className={labelCls}>Host</label>
            <input id="smtpHost" name="smtpHost" type="text" required value={form.smtpHost} onChange={handleChange} className={inputCls} placeholder="smtp.example.com" />
            {fieldErrors.smtpHost?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="smtpPort" className={labelCls}>Port</label>
            <input id="smtpPort" name="smtpPort" type="number" min={1} max={65535} required value={form.smtpPort} onChange={handleChange} className={inputCls} />
            {fieldErrors.smtpPort?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="smtpUser" className={labelCls}>Username <span className="text-muted-foreground">(optional)</span></label>
            <input id="smtpUser" name="smtpUser" type="text" value={form.smtpUser} onChange={handleChange} className={inputCls} placeholder="apikey or username" />
            {fieldErrors.smtpUser?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input id="smtpSecure" name="smtpSecure" type="checkbox" checked={form.smtpSecure} onChange={handleChange} className="h-4 w-4 rounded border-border" />
            <label htmlFor="smtpSecure" className="text-sm">Use TLS (secure)</label>
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label htmlFor="smtpPassword" className={labelCls}>Password</label>
            <input
              id="smtpPassword"
              name="smtpPassword"
              type="password"
              value={form.smtpPassword}
              onChange={handleChange}
              disabled={form.clearPassword}
              className={inputCls}
              placeholder={passwordSet ? '•••••••• (leave blank to keep current)' : 'No password set'}
              autoComplete="new-password"
            />
            <div className="flex items-center gap-2 pt-1">
              <input id="clearPassword" name="clearPassword" type="checkbox" checked={form.clearPassword} onChange={handleChange} className="h-4 w-4 rounded border-border" />
              <label htmlFor="clearPassword" className="text-xs text-muted-foreground">
                Remove stored password
              </label>
            </div>
            {fieldErrors.smtpPassword?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label htmlFor="mailFrom" className={labelCls}>From address</label>
            <input id="mailFrom" name="mailFrom" type="text" required value={form.mailFrom} onChange={handleChange} className={inputCls} placeholder='"Inventory" <no-reply@example.com>' />
            {fieldErrors.mailFrom?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
          </div>
        </div>
      </section>

      {/* ── Recipients ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Inventory alert recipients</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who receives low-stock, out-of-stock, and near-expiry emails. Request lifecycle emails still go to the requester.
        </p>

        <div className="mt-5 space-y-2">
          <label htmlFor="recipientInput" className={labelCls}>Email addresses</label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2 min-h-[44px]">
            {recipients.map((email) => (
              <span key={email} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs">
                {email}
                <button type="button" onClick={() => removeRecipient(email)} aria-label={`Remove ${email}`} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="recipientInput"
              type="email"
              value={recipientDraft}
              onChange={(e) => setRecipientDraft(e.target.value)}
              onKeyDown={handleRecipientKey}
              onBlur={() => recipientDraft.trim() && tryAddRecipient(recipientDraft)}
              className="flex-1 min-w-[180px] bg-transparent text-sm focus:outline-none"
              placeholder={recipients.length === 0 ? 'ops@example.com' : 'Add another…'}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter, comma, or space to add. Leaving this empty silences inventory alerts.
          </p>
          {fieldErrors.alertRecipients?.map((m) => <p key={m} className="text-xs text-red-600">{m}</p>)}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save settings'}
        </button>
        {initial.updatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(initial.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </form>
  );
}
