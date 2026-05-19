'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { Prisma } from '@prisma/client';

interface AuditDiffModalProps {
  open: boolean;
  onClose: () => void;
  action: string;
  diff: Prisma.JsonValue | null;
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function DiffRows({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return (
    <>
      {keys.map((key) => {
        const oldVal = renderValue(before[key]);
        const newVal = renderValue(after[key]);
        const changed = oldVal !== newVal;
        return (
          <tr key={key} className={changed ? 'bg-muted/30' : undefined}>
            <td className="px-3 py-2 font-mono text-xs font-medium text-muted-foreground align-top">{key}</td>
            <td className="px-3 py-2 font-mono text-xs text-rose-600 dark:text-rose-400 align-top break-all">
              {changed ? oldVal : <span className="text-muted-foreground">{oldVal}</span>}
            </td>
            <td className="px-3 py-2 font-mono text-xs text-emerald-600 dark:text-emerald-400 align-top break-all">
              {changed ? newVal : <span className="text-muted-foreground">{newVal}</span>}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export function AuditDiffModal({ open, onClose, action, diff }: AuditDiffModalProps) {
  const hasBeforeAfter =
    diff !== null &&
    diff !== undefined &&
    typeof diff === 'object' &&
    !Array.isArray(diff) &&
    ('before' in diff || 'after' in diff);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">Diff Detail</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground font-mono">
                {action}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none"
                aria-label="Close"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path
                    d="M11.7816 4.03157C12.0062 3.80697 12.0062 3.44303 11.7816 3.21843C11.557 2.99383 11.193 2.99383 10.9684 3.21843L7.50001 6.68682L4.03157 3.21843C3.80698 2.99383 3.44305 2.99383 3.21845 3.21843C2.99385 3.44303 2.99385 3.80697 3.21845 4.03157L6.68688 7.5L3.21845 10.9684C2.99385 11.193 2.99385 11.557 3.21845 11.7816C3.44305 12.0062 3.80698 12.0062 4.03157 11.7816L7.50001 8.31322L10.9684 11.7816C11.193 12.0062 11.557 12.0062 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31314 7.5L11.7816 4.03157Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-5">
            {diff === null || diff === undefined ? (
              <p className="text-sm text-muted-foreground">No diff recorded.</p>
            ) : hasBeforeAfter ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Field</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400">Before</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-emerald-600 dark:text-emerald-400">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <DiffRows
                      before={((diff as Record<string, unknown>).before as Record<string, unknown>) ?? {}}
                      after={((diff as Record<string, unknown>).after as Record<string, unknown>) ?? {}}
                    />
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs text-foreground">
                {JSON.stringify(diff, null, 2)}
              </pre>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
