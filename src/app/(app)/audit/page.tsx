import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { listAuditLogs, ListAuditLogsDto } from '@/server/modules/audit';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTable } from '@/components/audit/audit-table';

export const metadata: Metadata = { title: 'Audit Log' };
export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor || actor.role === 'VIEWER') redirect('/');

  const sp = await searchParams;

  const input = ListAuditLogsDto.parse({
    action: sp.action || undefined,
    actorId: sp.actorId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    limit: sp.limit ? Number(sp.limit) : 50,
    cursor: sp.cursor || undefined,
  });

  const { data: logs, nextCursor } = await listAuditLogs(input);

  // Build CSV export URL preserving current filters
  const csvParams = new URLSearchParams();
  if (sp.action) csvParams.set('action', sp.action);
  if (sp.actorId) csvParams.set('actorId', sp.actorId);
  if (sp.from) csvParams.set('from', sp.from);
  if (sp.to) csvParams.set('to', sp.to);
  csvParams.set('format', 'csv');

  // Build load-more URL by appending next cursor to existing params
  const loadMoreParams = new URLSearchParams(sp as Record<string, string>);
  if (nextCursor) loadMoreParams.set('cursor', nextCursor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Immutable record of all system actions</p>
        </div>
        <Link
          href={`/api/v1/audit-logs?${csvParams.toString()}`}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Export CSV
        </Link>
      </div>

      <Suspense>
        <AuditFilters />
      </Suspense>

      <AuditTable logs={logs} />

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Link
            href={`/audit?${loadMoreParams.toString()}`}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
