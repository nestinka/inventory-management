import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { listRequests, REQUEST_SORTABLE_COLUMNS } from '@/server/modules/requests';
import type { Actor } from '@/server/auth/rbac';
import { RequestFilters } from '@/components/requests/request-filters';
import { SortableHeader, type SortDir } from '@/components/ui/sortable-header';
import { formatDateTime } from '@/lib/utils';
import { RequestStatus } from '@prisma/client';

export const metadata: Metadata = { title: 'Requests' };
export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  PENDING:   'bg-amber-50   text-amber-700',
  APPROVED:  'bg-emerald-50 text-emerald-700',
  REJECTED:  'bg-rose-50    text-rose-700',
  FULFILLED: 'bg-blue-50    text-blue-700',
  CANCELLED: 'bg-slate-100  text-slate-600',
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor) return null;

  const sp = await searchParams;
  const statusFilter = Object.values(RequestStatus).includes(sp.status as RequestStatus)
    ? (sp.status as RequestStatus)
    : undefined;

  const sortBy = (REQUEST_SORTABLE_COLUMNS as readonly string[]).includes(sp.sortBy ?? '')
    ? (sp.sortBy as (typeof REQUEST_SORTABLE_COLUMNS)[number])
    : 'createdAt';
  const sortDir: SortDir = sp.sortDir === 'asc' ? 'asc' : 'desc';

  const { data: requests } = await listRequests({ limit: 50, status: statusFilter, sortBy, sortDir }, actor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
        </div>
        {actor && (
          <Link
            href="/requests/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New request
          </Link>
        )}
      </div>

      <Suspense>
        <RequestFilters />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground">
                <th>ID</th>
                <th>Requester</th>
                <SortableHeader column="status" label="Status" currentSort={sortBy} currentDir={sortDir} searchParams={sp} />
                <th className="hidden md:table-cell">Lines</th>
                <SortableHeader column="createdAt" label="Created" currentSort={sortBy} currentDir={sortDir} searchParams={sp} className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    <Link href={`/requests/${req.id}`} className="hover:text-primary hover:underline">
                      {req.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{req.requester.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[req.status] ?? ''}`}>
                      {req.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{req.lines.length}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDateTime(req.createdAt)}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
