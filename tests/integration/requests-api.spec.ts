import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Actor } from '@/server/auth/rbac';

const mockSession: { actor: Actor | null } = { actor: null };
vi.mock('@/server/auth/session', () => ({
  getActor: vi.fn(async () => mockSession.actor),
}));

import { POST as createRequest, GET as listRequests } from '@/app/api/v1/requests/route';
import { GET as getRequest } from '@/app/api/v1/requests/[id]/route';
import { POST as approveRequest } from '@/app/api/v1/requests/[id]/approve/route';
import { POST as rejectRequest } from '@/app/api/v1/requests/[id]/reject/route';
import { POST as fulfilRequest } from '@/app/api/v1/requests/[id]/fulfil/route';
import { prisma, resetDatabase } from '../helpers/db';
import { makeRequest } from '../helpers/http';
import { TestFactory } from '../helpers/factories';

const BASE = 'http://localhost:7000/api/v1/requests';

function actorFrom(u: { id: string; name: string; email: string; role: string }): Actor {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Actor['role'] };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

let admin: Actor;
let editor: Actor;
let editorB: Actor;
let viewer: Actor;
let itemId: string;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  const factory = new TestFactory();
  admin = actorFrom(await factory.createUser({ role: 'ADMIN' }));
  editor = actorFrom(await factory.createUser({ role: 'EDITOR' }));
  editorB = actorFrom(await factory.createUser({ role: 'EDITOR' }));
  viewer = actorFrom(await factory.createUser({ role: 'VIEWER' }));
  const category = await factory.createCategory();
  categoryId = category.id;
  itemId = (await factory.createItem(category.id, admin.id)).id; // currentStock 10, threshold 2
  mockSession.actor = null;
});

async function createOneLineRequest(actor: Actor, requestedQty = 4) {
  mockSession.actor = actor;
  const res = await createRequest(
    makeRequest('POST', BASE, { reason: 'Restock floor', lines: [{ itemId, requestedQty }] }),
  );
  return res;
}

describe('request lifecycle', () => {
  it('create → approve → fulfil decrements stock and records a FULFILMENT adjustment', async () => {
    // Editor submits
    const createRes = await createOneLineRequest(editor, 4);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('PENDING');
    const lineId = created.lines[0].id;

    // Admin approves all 4
    mockSession.actor = admin;
    const approveRes = await approveRequest(
      makeRequest('POST', `${BASE}/${created.id}/approve`, { lines: [{ lineId, approvedQty: 4 }] }),
      params(created.id),
    );
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()).status).toBe('APPROVED');

    // Admin fulfils all 4
    const fulfilRes = await fulfilRequest(
      makeRequest('POST', `${BASE}/${created.id}/fulfil`, { lines: [{ lineId, fulfilledQty: 4 }] }),
      params(created.id),
    );
    expect(fulfilRes.status).toBe(200);
    expect((await fulfilRes.json()).status).toBe('FULFILLED');

    // Stock dropped 10 → 6, with an audited FULFILMENT adjustment
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    expect(item?.currentStock).toBe(6);

    const adjustments = await prisma.stockAdjustment.findMany({ where: { itemId } });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.reason).toBe('FULFILMENT');
    expect(adjustments[0]?.delta).toBe(-4);
  });
});

describe('request read scoping', () => {
  it("lets an editor read another editor's request (200 — editors view all)", async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = editorB;
    const res = await getRequest(makeRequest('GET', `${BASE}/${created.id}`), params(created.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(created.id);
  });

  it("includes other users' requests in an editor's list (editors view all)", async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = editorB;
    const res = await listRequests(makeRequest('GET', BASE));
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.map((r: { id: string }) => r.id);
    expect(ids).toContain(created.id);
  });

  it("forbids a viewer from reading another user's request (403)", async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = viewer;
    const res = await getRequest(makeRequest('GET', `${BASE}/${created.id}`), params(created.id));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it("scopes a viewer's list to their own requests", async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = viewer;
    const res = await listRequests(makeRequest('GET', BASE));
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(created.id);
  });

  it('lets the owner read their own request (200)', async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = editor;
    const res = await getRequest(makeRequest('GET', `${BASE}/${created.id}`), params(created.id));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(created.id);
  });
});

describe('new (non-catalogue) item lines', () => {
  it('stores a proposed item with no catalogue link on create', async () => {
    mockSession.actor = editor;
    const res = await createRequest(
      makeRequest('POST', BASE, {
        reason: 'Need a new dock',
        lines: [{ newItem: { name: 'USB-C Dock', unitOfMeasure: 'pcs', categoryId }, requestedQty: 2 }],
      }),
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    const line = created.lines[0];
    expect(line.itemId).toBeNull();
    expect(line.item).toBeNull();
    expect(line.customItemName).toBe('USB-C Dock');
    expect(line.customUnit).toBe('pcs');
    expect(line.customCategory.id).toBe(categoryId);
  });

  it('promotes a proposed line into a real catalogue item on approval, then fulfils it', async () => {
    mockSession.actor = editor;
    const createRes = await createRequest(
      makeRequest('POST', BASE, {
        reason: 'Need a new dock',
        lines: [{ newItem: { name: 'Promoted Dock', unitOfMeasure: 'box', categoryId }, requestedQty: 3 }],
      }),
    );
    const created = await createRes.json();
    const lineId = created.lines[0].id;

    mockSession.actor = admin;
    const approveRes = await approveRequest(
      makeRequest('POST', `${BASE}/${created.id}/approve`, { lines: [{ lineId, approvedQty: 3 }] }),
      params(created.id),
    );
    expect(approveRes.status).toBe(200);

    // A real catalogue item now exists (0 stock) and the line links to it.
    const newItem = await prisma.item.findFirst({ where: { name: 'Promoted Dock' } });
    expect(newItem).not.toBeNull();
    expect(newItem?.categoryId).toBe(categoryId);
    expect(newItem?.unitOfMeasure).toBe('box');
    expect(newItem?.currentStock).toBe(0);
    expect(newItem?.createdById).toBe(admin.id);

    const promotedLine = await prisma.requestLine.findUnique({ where: { id: lineId } });
    expect(promotedLine?.itemId).toBe(newItem?.id);

    // Once stocked, it fulfils like any other item.
    await prisma.item.update({ where: { id: newItem!.id }, data: { currentStock: 5 } });
    const fulfilRes = await fulfilRequest(
      makeRequest('POST', `${BASE}/${created.id}/fulfil`, { lines: [{ lineId, fulfilledQty: 3 }] }),
      params(created.id),
    );
    expect(fulfilRes.status).toBe(200);
    const after = await prisma.item.findUnique({ where: { id: newItem!.id } });
    expect(after?.currentStock).toBe(2);
  });

  it('rejects a line with neither itemId nor newItem (422)', async () => {
    mockSession.actor = editor;
    const res = await createRequest(
      makeRequest('POST', BASE, { reason: 'bad', lines: [{ requestedQty: 1 }] }),
    );
    expect(res.status).toBe(422);
  });

  it('rejects a line with both itemId and newItem (422)', async () => {
    mockSession.actor = editor;
    const res = await createRequest(
      makeRequest('POST', BASE, {
        reason: 'bad',
        lines: [{ itemId, newItem: { name: 'X', unitOfMeasure: 'pcs', categoryId }, requestedQty: 1 }],
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('RBAC', () => {
  it('allows a VIEWER to create a request (201, matches current implementation)', async () => {
    const res = await createOneLineRequest(viewer, 1);
    expect(res.status).toBe(201);
  });

  it('allows an EDITOR to approve a request (200)', async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();
    const lineId = created.lines[0].id;

    mockSession.actor = editorB; // a different editor acts as approver
    const res = await approveRequest(
      makeRequest('POST', `${BASE}/${created.id}/approve`, { lines: [{ lineId, approvedQty: 2 }] }),
      params(created.id),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('APPROVED');
  });

  it('allows an EDITOR to reject a request (200)', async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();

    mockSession.actor = editorB;
    const res = await rejectRequest(
      makeRequest('POST', `${BASE}/${created.id}/reject`, { note: 'Not needed right now' }),
      params(created.id),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('REJECTED');
  });

  it('forbids an EDITOR from fulfilling (403 — fulfilment is admin-only)', async () => {
    const createRes = await createOneLineRequest(editor, 2);
    const created = await createRes.json();
    const lineId = created.lines[0].id;

    // Approve as admin so the request is in a fulfillable state …
    mockSession.actor = admin;
    await approveRequest(
      makeRequest('POST', `${BASE}/${created.id}/approve`, { lines: [{ lineId, approvedQty: 2 }] }),
      params(created.id),
    );

    // … an editor still cannot fulfil it.
    mockSession.actor = editor;
    const res = await fulfilRequest(
      makeRequest('POST', `${BASE}/${created.id}/fulfil`, { lines: [{ lineId, fulfilledQty: 1 }] }),
      params(created.id),
    );
    expect(res.status).toBe(403);
  });
});
