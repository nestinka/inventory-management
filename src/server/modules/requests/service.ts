import { RequestStatus, AdjustmentReason } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { eventBus } from '@/server/events/bus';
import { writeAudit } from '@/server/lib/audit';
import { ApiError } from '@/server/lib/errors';
import { requireOwnerOrAdmin } from '@/server/auth/rbac';
import type { Actor } from '@/server/auth/rbac';
import type { AuditContext } from '@/server/lib/audit';
import type {
  CreateRequestInput, ApproveRequestInput, RejectRequestInput,
  FulfilRequestInput, ListRequestsInput,
} from './dto';

const requestInclude = {
  requester: { select: { id: true, name: true, email: true } },
  approver: { select: { id: true, name: true, email: true } },
  lines: { include: { item: { select: { id: true, name: true, unitOfMeasure: true } } } },
  statusEvents: { orderBy: { createdAt: 'asc' as const } },
};

async function getOrFail(id: string) {
  const req = await prisma.request.findUnique({ where: { id }, include: requestInclude });
  if (!req) throw new ApiError('NOT_FOUND', 404, `Request ${id} not found`);
  return req;
}

function assertTransition(from: RequestStatus, to: RequestStatus) {
  const allowed: Partial<Record<RequestStatus, RequestStatus[]>> = {
    PENDING: [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
    APPROVED: [RequestStatus.FULFILLED, RequestStatus.CANCELLED],
  };
  if (!allowed[from]?.includes(to)) {
    throw new ApiError('INVALID_TRANSITION', 409, `Cannot transition from ${from} to ${to}`);
  }
}

export async function listRequests(input: ListRequestsInput, actor: Actor) {
  const selfOnly = actor.role === 'EDITOR' || actor.role === 'VIEWER';
  const where = {
    ...(input.status && { status: input.status }),
    ...(selfOnly && { requesterId: actor.id }),
    ...(input.requesterId && !selfOnly && { requesterId: input.requesterId }),
    ...(input.from && { createdAt: { gte: new Date(input.from) } }),
    ...(input.to && { createdAt: { lte: new Date(input.to) } }),
  };

  const requests = await prisma.request.findMany({
    where,
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
    take: input.limit + 1,
    ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
  });

  const hasMore = requests.length > input.limit;
  const data = hasMore ? requests.slice(0, -1) : requests;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null };
}

export async function getRequest(id: string, actor: Actor) {
  const req = await getOrFail(id);
  if (actor.role === 'EDITOR' || actor.role === 'VIEWER') requireOwnerOrAdmin(req.requesterId, actor);
  return req;
}

export async function createRequest(input: CreateRequestInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.request.create({
      data: {
        requesterId: actor.id,
        reason: input.reason,
        status: RequestStatus.PENDING,
        lines: {
          create: input.lines.map((l) => ({
            itemId: l.itemId,
            requestedQty: l.requestedQty,
          })),
        },
      },
      include: requestInclude,
    });

    await tx.requestStatusEvent.create({
      data: { requestId: req.id, fromStatus: null, toStatus: RequestStatus.PENDING, actorId: actor.id },
    });

    await writeAudit(tx, {
      actorId: actor.id, action: 'request.create', targetType: 'request',
      targetId: req.id, diff: { after: { id: req.id, lines: input.lines } }, ctx,
    });

    await eventBus.emit(tx, 'request.submitted', {
      requestId: req.id, requesterName: actor.name, lineCount: input.lines.length,
    });

    return req;
  });
}

export async function approveRequest(id: string, input: ApproveRequestInput, actor: Actor, ctx?: AuditContext) {
  const req = await getOrFail(id);
  assertTransition(req.status, RequestStatus.APPROVED);

  return prisma.$transaction(async (tx) => {
    for (const l of input.lines) {
      const line = req.lines.find((rl) => rl.id === l.lineId);
      if (!line) throw new ApiError('NOT_FOUND', 404, `Line ${l.lineId} not found`);
      if (l.approvedQty > line.requestedQty)
        throw new ApiError('VALIDATION_FAILED', 422, `approvedQty cannot exceed requestedQty for line ${l.lineId}`);
      await tx.requestLine.update({ where: { id: l.lineId }, data: { approvedQty: l.approvedQty } });
    }

    const updated = await tx.request.update({
      where: { id },
      data: { status: RequestStatus.APPROVED, approverId: actor.id, approvedAt: new Date() },
      include: requestInclude,
    });

    await tx.requestStatusEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: RequestStatus.APPROVED, actorId: actor.id, note: input.note ?? null },
    });

    await writeAudit(tx, {
      actorId: actor.id, action: 'request.approve', targetType: 'request',
      targetId: id, diff: { from: req.status, to: RequestStatus.APPROVED, lines: input.lines }, ctx,
    });

    await eventBus.emit(tx, 'request.approved', { requestId: id, requesterId: req.requesterId, lines: input.lines });

    return updated;
  });
}

export async function rejectRequest(id: string, input: RejectRequestInput, actor: Actor, ctx?: AuditContext) {
  const req = await getOrFail(id);
  assertTransition(req.status, RequestStatus.REJECTED);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id },
      data: { status: RequestStatus.REJECTED, approverId: actor.id },
      include: requestInclude,
    });

    await tx.requestStatusEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: RequestStatus.REJECTED, actorId: actor.id, note: input.note },
    });

    await writeAudit(tx, {
      actorId: actor.id, action: 'request.reject', targetType: 'request',
      targetId: id, diff: { from: req.status, to: RequestStatus.REJECTED, note: input.note }, ctx,
    });

    await eventBus.emit(tx, 'request.rejected', { requestId: id, requesterId: req.requesterId, note: input.note });

    return updated;
  });
}

export async function cancelRequest(id: string, actor: Actor, ctx?: AuditContext) {
  const req = await getOrFail(id);
  if (actor.role === 'EDITOR' || actor.role === 'VIEWER') requireOwnerOrAdmin(req.requesterId, actor);
  assertTransition(req.status, RequestStatus.CANCELLED);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.request.update({
      where: { id }, data: { status: RequestStatus.CANCELLED }, include: requestInclude,
    });
    await tx.requestStatusEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: RequestStatus.CANCELLED, actorId: actor.id },
    });
    await writeAudit(tx, {
      actorId: actor.id, action: 'request.cancel', targetType: 'request',
      targetId: id, diff: { from: req.status, to: RequestStatus.CANCELLED }, ctx,
    });
    return updated;
  });
}

export async function fulfilRequest(id: string, input: FulfilRequestInput, actor: Actor, ctx?: AuditContext) {
  const req = await getOrFail(id);
  assertTransition(req.status, RequestStatus.FULFILLED);

  return prisma.$transaction(async (tx) => {
    for (const l of input.lines) {
      const line = req.lines.find((rl) => rl.id === l.lineId);
      if (!line) throw new ApiError('NOT_FOUND', 404, `Line ${l.lineId} not found`);
      if (l.fulfilledQty > (line.approvedQty ?? 0))
        throw new ApiError('VALIDATION_FAILED', 422, `fulfilledQty cannot exceed approvedQty for line ${l.lineId}`);

      if (l.fulfilledQty > 0) {
        const item = await tx.item.findFirst({ where: { id: line.itemId, deletedAt: null } });
        if (!item) throw new ApiError('NOT_FOUND', 404, `Item ${line.itemId} not found`);

        const newStock = item.currentStock - l.fulfilledQty;
        if (newStock < 0) throw new ApiError('STOCK_BELOW_ZERO', 409, `Insufficient stock for item ${item.name}`);

        await tx.item.update({ where: { id: item.id }, data: { currentStock: newStock } });
        await tx.stockAdjustment.create({
          data: {
            itemId: item.id, delta: -l.fulfilledQty, balanceAfter: newStock,
            reason: AdjustmentReason.FULFILMENT, actorId: actor.id, requestId: id,
          },
        });

        if (newStock < item.reorderThreshold) {
          await eventBus.emit(tx, 'item.lowStock', {
            itemId: item.id, name: item.name,
            currentStock: newStock, threshold: item.reorderThreshold,
          });
        }
      }

      await tx.requestLine.update({ where: { id: l.lineId }, data: { fulfilledQty: l.fulfilledQty } });
    }

    const updated = await tx.request.update({
      where: { id }, data: { status: RequestStatus.FULFILLED, fulfilledAt: new Date() }, include: requestInclude,
    });

    await tx.requestStatusEvent.create({
      data: { requestId: id, fromStatus: req.status, toStatus: RequestStatus.FULFILLED, actorId: actor.id },
    });

    await writeAudit(tx, {
      actorId: actor.id, action: 'request.fulfil', targetType: 'request',
      targetId: id, diff: { from: req.status, to: RequestStatus.FULFILLED, lines: input.lines }, ctx,
    });

    await eventBus.emit(tx, 'request.fulfilled', { requestId: id, requesterId: req.requesterId });

    return updated;
  });
}
