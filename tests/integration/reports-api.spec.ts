import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdjustmentReason, RequestStatus } from '@prisma/client';
import type { Actor } from '@/server/auth/rbac';

const mockSession: { actor: Actor | null } = { actor: null };
vi.mock('@/server/auth/session', () => ({
  getActor: vi.fn(async () => mockSession.actor),
}));

import { GET as inventorySnapshotRoute } from '@/app/api/v1/reports/inventory-snapshot/route';
import { GET as lowStockRoute } from '@/app/api/v1/reports/low-stock/route';
import { GET as nearExpiryRoute } from '@/app/api/v1/reports/near-expiry/route';
import { GET as consumptionRoute } from '@/app/api/v1/reports/consumption/route';
import { GET as requestAnalyticsRoute } from '@/app/api/v1/reports/request-analytics/route';
import { prisma, resetDatabase } from '../helpers/db';
import { makeRequest } from '../helpers/http';
import { TestFactory } from '../helpers/factories';

const BASE = 'http://localhost:7000/api/v1/reports';

function actorFrom(u: { id: string; name: string; email: string; role: string }): Actor {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Actor['role'] };
}

let admin: Actor;
let editor: Actor;
let viewer: Actor;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  const f = new TestFactory();
  admin = actorFrom(await f.createUser({ role: 'ADMIN' }));
  editor = actorFrom(await f.createUser({ role: 'EDITOR' }));
  viewer = actorFrom(await f.createUser({ role: 'VIEWER' }));
  categoryId = (await f.createCategory({ name: 'Consumables' })).id;
  mockSession.actor = null;
});

// ───────────────────────────────────────────────────────────────────────────────
// inventory-snapshot
// ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/inventory-snapshot', () => {
  it('returns active items only and derives stockState correctly', async () => {
    const f = new TestFactory();
    const a = await f.createItem(categoryId, admin.id, { name: 'Healthy' });
    const b = await f.createItem(categoryId, admin.id, { name: 'LowStock' });
    const c = await f.createItem(categoryId, admin.id, { name: 'OutOfStock' });
    const soft = await f.createItem(categoryId, admin.id, { name: 'Deleted' });
    await prisma.item.update({ where: { id: a.id }, data: { currentStock: 10, reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: b.id }, data: { currentStock: 2,  reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: c.id }, data: { currentStock: 0,  reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: soft.id }, data: { deletedAt: new Date() } });

    mockSession.actor = admin;
    const res = await inventorySnapshotRoute(makeRequest('GET', `${BASE}/inventory-snapshot`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string; stockState: string }>;
    expect(body.map((r) => r.name).sort()).toEqual(['Healthy', 'LowStock', 'OutOfStock']);
    const byName = Object.fromEntries(body.map((r) => [r.name, r.stockState]));
    expect(byName.Healthy).toBe('HEALTHY');
    expect(byName.LowStock).toBe('LOW');
    expect(byName.OutOfStock).toBe('OUT');
  });

  it('returns CSV with correct headers when format=csv', async () => {
    mockSession.actor = admin;
    const res = await inventorySnapshotRoute(
      makeRequest('GET', `${BASE}/inventory-snapshot?format=csv`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    const text = await res.text();
    expect(text.split('\r\n')[0]).toBe(
      'Name,Category,Unit,Current Stock,Reorder Threshold,Stock State,Status,Expiry Date',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// low-stock
// ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/low-stock', () => {
  it('partitions items into LOW vs OUT and excludes healthy items', async () => {
    const f = new TestFactory();
    const a = await f.createItem(categoryId, admin.id, { name: 'Healthy' });
    const b = await f.createItem(categoryId, admin.id, { name: 'Below' });
    const c = await f.createItem(categoryId, admin.id, { name: 'AtZero' });
    await prisma.item.update({ where: { id: a.id }, data: { currentStock: 100, reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: b.id }, data: { currentStock: 2,   reorderThreshold: 5 } });
    await prisma.item.update({ where: { id: c.id }, data: { currentStock: 0,   reorderThreshold: 5 } });

    mockSession.actor = admin;
    const res = await lowStockRoute(makeRequest('GET', `${BASE}/low-stock`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string; stockState: 'LOW' | 'OUT' }>;
    const byName = Object.fromEntries(body.map((r) => [r.name, r.stockState]));
    expect(byName).toEqual({ Below: 'LOW', AtZero: 'OUT' });
    expect(byName.Healthy).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// near-expiry
// ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/near-expiry', () => {
  it('includes only items whose expiryDate falls inside the configured window', async () => {
    const f = new TestFactory();
    const inWindow = await f.createItem(categoryId, admin.id, { name: 'ExpiresSoon' });
    const outOfWindow = await f.createItem(categoryId, admin.id, { name: 'ExpiresLater' });
    await f.createItem(categoryId, admin.id, { name: 'NoExpiry' }); // left with expiryDate = null

    const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await prisma.item.update({ where: { id: inWindow.id },    data: { expiryDate: in15Days } });
    await prisma.item.update({ where: { id: outOfWindow.id }, data: { expiryDate: in90Days } });

    mockSession.actor = admin;
    const res = await nearExpiryRoute(makeRequest('GET', `${BASE}/near-expiry?days=30`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string }>;
    const names = body.map((r) => r.name);
    expect(names).toContain('ExpiresSoon');
    expect(names).not.toContain('ExpiresLater');
    expect(names).not.toContain('NoExpiry');
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// consumption
// ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/consumption', () => {
  it('aggregates stock_adjustments by date and reason', async () => {
    const f = new TestFactory();
    const item = await f.createItem(categoryId, admin.id);
    const today = new Date('2026-04-15T10:00:00Z');

    await prisma.stockAdjustment.createMany({
      data: [
        { itemId: item.id, delta: -2, balanceAfter: 8, reason: AdjustmentReason.CONSUMPTION, actorId: admin.id, createdAt: today },
        { itemId: item.id, delta: -1, balanceAfter: 7, reason: AdjustmentReason.CONSUMPTION, actorId: admin.id, createdAt: today },
        { itemId: item.id, delta: -3, balanceAfter: 4, reason: AdjustmentReason.FULFILMENT,  actorId: admin.id, createdAt: today },
        // RECEIVED is not in the consumption reasons set — should be excluded.
        { itemId: item.id, delta:  5, balanceAfter: 9, reason: AdjustmentReason.RECEIVED,    actorId: admin.id, createdAt: today },
      ],
    });

    mockSession.actor = admin;
    const res = await consumptionRoute(makeRequest('GET', `${BASE}/consumption`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ date: string; reason: string; totalDelta: number; count: number }>;

    const byReason = Object.fromEntries(body.map((r) => [r.reason, r]));
    expect(byReason.CONSUMPTION).toEqual({ date: '2026-04-15', reason: 'CONSUMPTION', totalDelta: -3, count: 2 });
    expect(byReason.FULFILMENT).toEqual({ date: '2026-04-15', reason: 'FULFILMENT', totalDelta: -3, count: 1 });
    expect(byReason.RECEIVED).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// request-analytics
// ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/request-analytics', () => {
  it('returns byStatus, totalLines, fulfilmentRate and avgApprovalTimeHours', async () => {
    const f = new TestFactory();
    const item = await f.createItem(categoryId, admin.id);

    // 1 APPROVED request approved 2h after creation, 1 line
    const created1 = new Date('2026-04-10T08:00:00Z');
    const approved1 = new Date('2026-04-10T10:00:00Z');
    await prisma.request.create({
      data: {
        requesterId: editor.id, reason: 'approved-1',
        status: RequestStatus.APPROVED, approverId: admin.id,
        createdAt: created1, approvedAt: approved1,
        lines: { create: [{ itemId: item.id, requestedQty: 5, approvedQty: 5 }] },
      },
    });

    // 1 FULFILLED request approved 4h after creation, 2 lines
    const created2 = new Date('2026-04-11T08:00:00Z');
    const approved2 = new Date('2026-04-11T12:00:00Z');
    await prisma.request.create({
      data: {
        requesterId: editor.id, reason: 'fulfilled-1',
        status: RequestStatus.FULFILLED, approverId: admin.id,
        createdAt: created2, approvedAt: approved2,
        lines: { create: [
          { itemId: item.id, requestedQty: 3, approvedQty: 3, fulfilledQty: 3 },
          { itemId: item.id, requestedQty: 1, approvedQty: 1, fulfilledQty: 1 },
        ] },
      },
    });

    // 1 PENDING request, 1 line, not approved yet
    await prisma.request.create({
      data: {
        requesterId: editor.id, reason: 'pending-1',
        status: RequestStatus.PENDING,
        lines: { create: [{ itemId: item.id, requestedQty: 7 }] },
      },
    });

    mockSession.actor = admin;
    const res = await requestAnalyticsRoute(makeRequest('GET', `${BASE}/request-analytics`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      byStatus: Array<{ status: string; count: number }>;
      avgApprovalTimeHours: number | null;
      totalLines: number;
      fulfilmentRate: number;
    };

    const byStatusMap = Object.fromEntries(body.byStatus.map((r) => [r.status, r.count]));
    expect(byStatusMap.APPROVED).toBe(1);
    expect(byStatusMap.FULFILLED).toBe(1);
    expect(byStatusMap.PENDING).toBe(1);
    expect(body.totalLines).toBe(4); // 1 + 2 + 1

    // approval times: 2h and 4h → avg 3h
    expect(body.avgApprovalTimeHours).toBeCloseTo(3, 5);
    // fulfilmentRate: 1 fulfilled / (1 approved + 1 fulfilled) = 50%
    expect(body.fulfilmentRate).toBeCloseTo(50, 5);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// RBAC — current code allows ADMIN + EDITOR on every report endpoint and rejects
// VIEWER. docs/06-rbac-matrix.md disagrees (it lists VIEWER as allowed for the
// four asset reports and disallowed-EDITOR for request-analytics). The
// reconciliation is tracked in the doc-drift task; these tests pin the current
// behaviour so a code change is a deliberate decision.
// ───────────────────────────────────────────────────────────────────────────────

describe('reports RBAC (route-guard layer, pinning current behaviour)', () => {
  const cases: Array<[string, (req: ReturnType<typeof makeRequest>) => Promise<Response>]> = [
    ['inventory-snapshot', (r) => inventorySnapshotRoute(r)],
    ['low-stock',          (r) => lowStockRoute(r)],
    ['near-expiry',        (r) => nearExpiryRoute(r)],
    ['consumption',        (r) => consumptionRoute(r)],
    ['request-analytics',  (r) => requestAnalyticsRoute(r)],
  ];

  it.each(cases)('VIEWER receives 403 on /%s', async (slug, invoke) => {
    mockSession.actor = viewer;
    const res = await invoke(makeRequest('GET', `${BASE}/${slug}`));
    expect(res.status).toBe(403);
  });

  it.each(cases)('unauthenticated receives 401 on /%s', async (slug, invoke) => {
    mockSession.actor = null;
    const res = await invoke(makeRequest('GET', `${BASE}/${slug}`));
    expect(res.status).toBe(401);
  });
});
