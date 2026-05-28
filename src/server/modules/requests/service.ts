import { RequestStatus, AdjustmentReason, ItemStatus } from '@prisma/client';
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
  lines: {
    include: {
      item: { select: { id: true, name: true, unitOfMeasure: true } },
      customCategory: { select: { id: true, name: true } },
    },
  },
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
  // ADMIN and EDITOR see all requests; VIEWER is scoped to their own.
  const selfOnly = actor.role === 'VIEWER';
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
  // ADMIN and EDITOR may read any request; VIEWER only their own.
  if (actor.role === 'VIEWER') requireOwnerOrAdmin(req.requesterId, actor);
  return req;
}

export async function createRequest(input: CreateRequestInput, actor: Actor, ctx?: AuditContext) {
  return prisma.$transaction(async (tx) => {
    // Validate proposed (non-catalogue) lines reference a real, active category.
    const proposedCategoryIds = [
      ...new Set(input.lines.flatMap((l) => (l.newItem ? [l.newItem.categoryId] : []))),
    ];
    if (proposedCategoryIds.length > 0) {
      const found = await tx.category.findMany({
        where: { id: { in: proposedCategoryIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      const ok = new Set(found.map((c) => c.id));
      for (const id of proposedCategoryIds) {
        if (!ok.has(id)) throw new ApiError('VALIDATION_FAILED', 422, `Category ${id} not found or inactive`);
      }
    }

    const req = await tx.request.create({
      data: {
        requesterId: actor.id,
        reason: input.reason,
        status: RequestStatus.PENDING,
        lines: {
          create: input.lines.map((l) =>
            l.itemId
              ? { itemId: l.itemId, requestedQty: l.requestedQty }
              : {
                  requestedQty: l.requestedQty,
                  customItemName: l.newItem!.name,
                  customUnit: l.newItem!.unitOfMeasure,
                  customCategoryId: l.newItem!.categoryId,
                },
          ),
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

      // Promote a proposed (non-catalogue) line into a real item on approval, so
      // it can be fulfilled like any other. Only when the line is actually approved.
      let promotedItemId: string | null = null;
      if (!line.itemId && l.approvedQty > 0) {
        if (!line.customItemName || !line.customUnit || !line.customCategoryId) {
          throw new ApiError('VALIDATION_FAILED', 422, `Line ${l.lineId} is missing new-item details`);
        }
        const created = await tx.item.create({
          data: {
            name: line.customItemName,
            unitOfMeasure: line.customUnit,
            categoryId: line.customCategoryId,
            currentStock: 0,
            reorderThreshold: 0,
            status: ItemStatus.ACTIVE,
            createdById: actor.id,
          },
        });
        promotedItemId = created.id;
        await writeAudit(tx, {
          actorId: actor.id, action: 'item.create', targetType: 'item',
          targetId: created.id, diff: { after: created, viaRequest: id }, ctx,
        });
      }

      await tx.requestLine.update({
        where: { id: l.lineId },
        data: { approvedQty: l.approvedQty, ...(promotedItemId ? { itemId: promotedItemId } : {}) },
      });
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
        if (!line.itemId)
          throw new ApiError('VALIDATION_FAILED', 422, `Line ${l.lineId} has no catalogue item to fulfil`);
        // SELECT ... FOR UPDATE serialises concurrent stock mutations on the
        // same item (fulfilment, adjust, or other concurrent fulfilment).
        const rows = await tx.$queryRaw<Array<{
          id: string;
          name: string;
          current_stock: number;
          reorder_threshold: number;
          deleted_at: Date | null;
        }>>`SELECT id, name, current_stock, reorder_threshold, deleted_at
            FROM items
            WHERE id = ${line.itemId}::uuid
            FOR UPDATE`;
        const row = rows[0];
        if (!row || row.deleted_at) throw new ApiError('NOT_FOUND', 404, `Item ${line.itemId} not found`);
        const item = {
          id: row.id,
          name: row.name,
          currentStock: Number(row.current_stock),
          reorderThreshold: Number(row.reorder_threshold),
        };

        const newStock = item.currentStock - l.fulfilledQty;
        if (newStock < 0) throw new ApiError('STOCK_BELOW_ZERO', 409, `Insufficient stock for item ${item.name}`);

        await tx.item.update({ where: { id: item.id }, data: { currentStock: newStock } });
        await tx.stockAdjustment.create({
          data: {
            itemId: item.id, delta: -l.fulfilledQty, balanceAfter: newStock,
            reason: AdjustmentReason.FULFILMENT, actorId: actor.id, requestId: id,
          },
        });

        // Mirror stockService.adjust: out-of-stock takes priority over low-stock.
        if (newStock === 0) {
          await eventBus.emit(tx, 'item.outOfStock', {
            itemId: item.id, name: item.name,
            currentStock: 0, threshold: item.reorderThreshold,
          });
        } else if (newStock < item.reorderThreshold) {
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
