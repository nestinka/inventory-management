import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Actor } from '@/server/auth/rbac';

// Replace the NextAuth-backed session with a settable actor. Hoisted above the
// route imports by Vitest; `mockSession` is allowed because of the `mock` prefix.
const mockSession: { actor: Actor | null } = { actor: null };
vi.mock('@/server/auth/session', () => ({
  getActor: vi.fn(async () => mockSession.actor),
}));

import { GET as listItems, POST as createItem } from '@/app/api/v1/items/route';
import {
  GET as getItemById,
  PATCH as patchItem,
  DELETE as deleteItemById,
} from '@/app/api/v1/items/[id]/route';
import { resetDatabase } from '../helpers/db';
import { makeRequest } from '../helpers/http';
import { TestFactory } from '../helpers/factories';

const BASE = 'http://localhost:7000/api/v1/items';

function actorFrom(u: { id: string; name: string; email: string; role: string }): Actor {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Actor['role'] };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

let admin: Actor;
let editor: Actor;
let viewer: Actor;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  const factory = new TestFactory();
  admin = actorFrom(await factory.createUser({ role: 'ADMIN' }));
  editor = actorFrom(await factory.createUser({ role: 'EDITOR' }));
  viewer = actorFrom(await factory.createUser({ role: 'VIEWER' }));
  categoryId = (await factory.createCategory()).id;
  mockSession.actor = null;
});

describe('POST /api/v1/items', () => {
  const validBody = () => ({ name: 'Widget', unitOfMeasure: 'pcs', categoryId });

  it('lets an EDITOR create an item (201)', async () => {
    mockSession.actor = editor;
    const res = await createItem(makeRequest('POST', BASE, validBody()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: 'Widget', categoryId });
    expect(body.id).toBeTruthy();
  });

  it('rejects a VIEWER with 403', async () => {
    mockSession.actor = viewer;
    const res = await createItem(makeRequest('POST', BASE, validBody()));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('rejects an invalid body with 422', async () => {
    mockSession.actor = editor;
    const res = await createItem(makeRequest('POST', BASE, { unitOfMeasure: 'pcs', categoryId }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('requires authentication (401)', async () => {
    mockSession.actor = null;
    const res = await createItem(makeRequest('POST', BASE, validBody()));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/items', () => {
  it('returns a paginated envelope for an authenticated user', async () => {
    mockSession.actor = viewer;
    const factory = new TestFactory();
    await factory.createItem(categoryId, admin.id, { name: 'Listed' });

    const res = await listItems(makeRequest('GET', BASE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body).toHaveProperty('nextCursor');
  });
});

describe('GET /api/v1/items/[id]', () => {
  it('returns an existing item with derived stockState', async () => {
    mockSession.actor = viewer;
    const factory = new TestFactory();
    const item = await factory.createItem(categoryId, admin.id);

    const res = await getItemById(makeRequest('GET', `${BASE}/${item.id}`), params(item.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(item.id);
    expect(body.stockState).toBeDefined();
  });

  it('returns 404 for an unknown id', async () => {
    mockSession.actor = viewer;
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await getItemById(makeRequest('GET', `${BASE}/${missing}`), params(missing));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/items/[id]', () => {
  it('lets an ADMIN update an item (200)', async () => {
    const factory = new TestFactory();
    const item = await factory.createItem(categoryId, admin.id);
    mockSession.actor = admin;

    const res = await patchItem(
      makeRequest('PATCH', `${BASE}/${item.id}`, { name: 'Renamed' }),
      params(item.id),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('Renamed');
  });

  it('rejects an EDITOR with 403', async () => {
    const factory = new TestFactory();
    const item = await factory.createItem(categoryId, admin.id);
    mockSession.actor = editor;

    const res = await patchItem(
      makeRequest('PATCH', `${BASE}/${item.id}`, { name: 'Nope' }),
      params(item.id),
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/items/[id]', () => {
  it('lets an ADMIN soft-delete an item (204)', async () => {
    const factory = new TestFactory();
    const item = await factory.createItem(categoryId, admin.id);
    mockSession.actor = admin;

    const res = await deleteItemById(makeRequest('DELETE', `${BASE}/${item.id}`), params(item.id));
    expect(res.status).toBe(204);
  });

  it('rejects an EDITOR with 403', async () => {
    const factory = new TestFactory();
    const item = await factory.createItem(categoryId, admin.id);
    mockSession.actor = editor;

    const res = await deleteItemById(makeRequest('DELETE', `${BASE}/${item.id}`), params(item.id));
    expect(res.status).toBe(403);
  });
});
