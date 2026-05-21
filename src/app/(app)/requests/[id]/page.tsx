import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import type { Actor } from '@/server/auth/rbac';
import { getRequest } from '@/server/modules/requests';
import { formatDate, formatDateTime } from '@/lib/utils';
import { RequestActionPanel } from '@/components/requests/request-action-panel';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Request ${id.slice(0, 8)} | Requests` };
}

const statusStyles: Record<string, string> = {
  PENDING:   'bg-amber-50   text-amber-700',
  APPROVED:  'bg-emerald-50 text-emerald-700',
  REJECTED:  'bg-rose-50    text-rose-700',
  FULFILLED: 'bg-blue-50    text-blue-700',
  CANCELLED: 'bg-slate-100  text-slate-600',
};

const eventStyles: Record<string, string> = {
  PENDING:   'bg-amber-400',
  APPROVED:  'bg-emerald-500',
  REJECTED:  'bg-rose-500',
  FULFILLED: 'bg-blue-500',
  CANCELLED: 'bg-slate-400',
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actor = session?.user as Actor | undefined;
  if (!actor) redirect('/login');

  const { id } = await params;
  const req = await getRequest(id, actor).catch(() => null);
  if (!req) notFound();

  const canAdmin = actor.role === 'ADMIN';
  const canApprove = actor.role === 'ADMIN' || actor.role === 'EDITOR';
  const isOwner = req.requesterId === actor.id;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
          <Link href="/requests" className="hover:text-foreground transition-colors">Requests</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground font-mono">{req.id.slice(0, 8)}…</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground font-mono">{req.id.slice(0, 8)}…</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[req.status] ?? ''}`}>
            {req.status.toLowerCase()}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
          <span>By {req.requester.name}</span>
          <span>{formatDateTime(req.createdAt)}</span>
        </div>
        {req.reason && (
          <p className="mt-2 text-sm text-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
            {req.reason}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: lines + action panel */}
        <div className="space-y-4">
          {/* Action panel */}
          <RequestActionPanel
            requestId={req.id}
            status={req.status}
            lines={req.lines.map((l) => ({
              id: l.id,
              requestedQty: l.requestedQty,
              approvedQty: l.approvedQty,
              item: { name: l.item?.name ?? l.customItemName ?? 'New item' },
            }))}
            canAdmin={canAdmin}
            canApprove={canApprove}
            isOwner={isOwner}
          />

          {/* Meta */}
          {(req.approver || req.approvedAt || req.fulfilledAt) && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-1.5 text-muted-foreground">
              {req.approver && <p>Approved by <span className="text-foreground">{req.approver.name}</span></p>}
              {req.approvedAt && <p>Approved {formatDate(req.approvedAt)}</p>}
              {req.fulfilledAt && <p>Fulfilled {formatDate(req.fulfilledAt)}</p>}
            </div>
          )}
        </div>

        {/* Right: lines table + timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lines table */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Lines
              <span className="ml-2 text-sm font-normal text-muted-foreground">({req.lines.length})</span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Requested</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Approved</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Fulfilled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {req.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {line.item ? line.item.name : line.customItemName}
                          {!line.item && (
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-medium text-primary">
                              New
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {line.item
                            ? line.item.unitOfMeasure
                            : [line.customUnit, line.customCategory?.name].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-foreground">{line.requestedQty}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {line.approvedQty != null ? line.approvedQty : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {line.fulfilledQty != null ? line.fulfilledQty : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status timeline */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-foreground">Timeline</h2>
            <div className="space-y-0">
              {req.statusEvents.map((ev, i) => (
                <div key={ev.id} className="flex gap-3">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${eventStyles[ev.toStatus] ?? 'bg-border'}`} />
                    {i < req.statusEvents.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  {/* Content */}
                  <div className={`pb-4 ${i < req.statusEvents.length - 1 ? '' : ''}`}>
                    <p className="text-sm text-foreground capitalize">
                      {ev.fromStatus ? `${ev.fromStatus.toLowerCase()} → ` : ''}
                      <span className="font-medium">{ev.toStatus.toLowerCase()}</span>
                    </p>
                    {ev.note && <p className="mt-0.5 text-xs text-muted-foreground">{ev.note}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(ev.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
