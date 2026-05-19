'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';
import { formatDateTime } from '@/lib/utils';
import { AuditDiffModal } from './audit-diff-modal';

interface AuditLogWithActor {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  diff: Prisma.JsonValue | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  actor: { id: string; name: string; email: string } | null;
}

interface AuditTableProps {
  logs: AuditLogWithActor[];
}

export function AuditTable({ logs }: AuditTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogWithActor | null>(null);

  function handleRowClick(log: AuditLogWithActor) {
    if (log.diff !== null && log.diff !== undefined) {
      setSelectedLog(log);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Target</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8" aria-label="Diff" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const hasDiff = log.diff !== null && log.diff !== undefined;
                return (
                  <tr
                    key={log.id}
                    onClick={() => handleRowClick(log)}
                    className={[
                      'transition-colors hover:bg-muted/30',
                      hasDiff ? 'cursor-pointer' : 'cursor-default',
                    ].join(' ')}
                    title={hasDiff ? 'Click to view diff' : undefined}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {log.actor ? (
                        <span title={log.actor.email}>{log.actor.name}</span>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {log.action}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                      {log.targetType}
                      {log.targetId ? `:${log.targetId.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasDiff && (
                        <span
                          aria-label="Has diff"
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground"
                        >
                          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                            <path
                              d="M9.96424 2.68571C10.0668 2.42931 9.94209 2.13833 9.6857 2.03577C9.4293 1.93322 9.13832 2.05792 9.03576 2.31432L5.03576 12.3143C4.9332 12.5707 5.05791 12.8617 5.3143 12.9642C5.5707 13.0668 5.86168 12.9421 5.96424 12.6857L9.96424 2.68571ZM3.85355 5.14646C4.04882 5.34172 4.04882 5.6583 3.85355 5.85356L2.20711 7.50001L3.85355 9.14646C4.04882 9.34172 4.04882 9.6583 3.85355 9.85356C3.65829 10.0488 3.34171 10.0488 3.14645 9.85356L1.14645 7.85356C0.951184 7.6583 0.951184 7.34172 1.14645 7.14646L3.14645 5.14646C3.34171 4.9512 3.65829 4.9512 3.85355 5.14646ZM11.1464 5.14646C11.3417 4.9512 11.6583 4.9512 11.8536 5.14646L13.8536 7.14646C14.0488 7.34172 14.0488 7.6583 13.8536 7.85356L11.8536 9.85356C11.6583 10.0488 11.3417 10.0488 11.1464 9.85356C10.9512 9.6583 10.9512 9.34172 11.1464 9.14646L12.7929 7.50001L11.1464 5.85356C10.9512 5.6583 10.9512 5.34172 11.1464 5.14646Z"
                              fill="currentColor"
                              fillRule="evenodd"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <AuditDiffModal
          open={selectedLog !== null}
          onClose={() => setSelectedLog(null)}
          action={selectedLog.action}
          diff={selectedLog.diff}
        />
      )}
    </>
  );
}
