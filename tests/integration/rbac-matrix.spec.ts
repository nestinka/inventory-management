import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { Actor, Role } from '@/server/auth/rbac';

const mockSession: { actor: Actor | null } = { actor: null };
vi.mock('@/server/auth/session', () => ({
  getActor: vi.fn(async () => mockSession.actor),
}));

import { GET as catList, POST as catCreate } from '@/app/api/v1/categories/route';
import {
  GET as catGet,
  PATCH as catUpdate,
  DELETE as catDeactivate,
  POST as catActivate,
} from '@/app/api/v1/categories/[id]/route';
import { GET as itemList, POST as itemCreate } from '@/app/api/v1/items/route';
import {
  GET as itemGet,
  PATCH as itemUpdate,
  DELETE as itemDelete,
} from '@/app/api/v1/items/[id]/route';
import { POST as stockAdjust } from '@/app/api/v1/stock/adjust/route';
import { GET as reqList, POST as reqCreate } from '@/app/api/v1/requests/route';
import { GET as reqGet } from '@/app/api/v1/requests/[id]/route';
import { POST as reqApprove } from '@/app/api/v1/requests/[id]/approve/route';
import { POST as reqReject } from '@/app/api/v1/requests/[id]/reject/route';
import { POST as reqFulfil } from '@/app/api/v1/requests/[id]/fulfil/route';
import { POST as reqCancel } from '@/app/api/v1/requests/[id]/cancel/route';
import { GET as userList, POST as userCreate } from '@/app/api/v1/users/route';
import { GET as auditList } from '@/app/api/v1/audit-logs/route';
import {
  GET as settingsGet,
  PUT as settingsPut,
} from '@/app/api/v1/settings/notifications/route';
import { resetDatabase } from '../helpers/db';
import { makeRequest, type HttpMethod } from '../helpers/http';

const ID = '00000000-0000-0000-0000-000000000000';
const ALL: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

type ColHandler = (req: NextRequest) => Promise<Response>;
type DynHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const withId = (h: DynHandler): ColHandler => (req) =>
  h(req, { params: Promise.resolve({ id: ID }) });

function actorWithRole(role: Role): Actor {
  return { id: '11111111-1111-1111-1111-111111111111', name: role, email: `${role}@test.local`, role };
}

type Endpoint = {
  label: string;
  method: HttpMethod;
  url: string;
  invoke: ColHandler;
  allow: Role[]; // route-guard layer; ALL = any authenticated user
};

// Route-guard policy as currently implemented. Comments mark cells that diverge
// from the original docs/06 matrix (docs were updated to match the code).
const endpoints: Endpoint[] = [
  { label: 'GET /categories', method: 'GET', url: '/api/v1/categories', invoke: catList, allow: ALL },
  { label: 'POST /categories', method: 'POST', url: '/api/v1/categories', invoke: catCreate, allow: ['ADMIN'] },
  { label: 'GET /categories/[id]', method: 'GET', url: `/api/v1/categories/${ID}`, invoke: withId(catGet), allow: ALL },
  { label: 'PATCH /categories/[id]', method: 'PATCH', url: `/api/v1/categories/${ID}`, invoke: withId(catUpdate), allow: ['ADMIN'] },
  { label: 'DELETE /categories/[id]', method: 'DELETE', url: `/api/v1/categories/${ID}`, invoke: withId(catDeactivate), allow: ['ADMIN'] },
  { label: 'POST /categories/[id] (activate)', method: 'POST', url: `/api/v1/categories/${ID}`, invoke: withId(catActivate), allow: ['ADMIN'] },

  { label: 'GET /items', method: 'GET', url: '/api/v1/items', invoke: itemList, allow: ALL },
  // docs/06 originally said create=ADMIN-only; code allows EDITOR too.
  { label: 'POST /items', method: 'POST', url: '/api/v1/items', invoke: itemCreate, allow: ['ADMIN', 'EDITOR'] },
  { label: 'GET /items/[id]', method: 'GET', url: `/api/v1/items/${ID}`, invoke: withId(itemGet), allow: ALL },
  { label: 'PATCH /items/[id]', method: 'PATCH', url: `/api/v1/items/${ID}`, invoke: withId(itemUpdate), allow: ['ADMIN'] },
  { label: 'DELETE /items/[id]', method: 'DELETE', url: `/api/v1/items/${ID}`, invoke: withId(itemDelete), allow: ['ADMIN'] },

  { label: 'POST /stock/adjust', method: 'POST', url: '/api/v1/stock/adjust', invoke: stockAdjust, allow: ['ADMIN', 'EDITOR'] },

  { label: 'GET /requests', method: 'GET', url: '/api/v1/requests', invoke: reqList, allow: ALL },
  // docs/06 originally said VIEWER cannot create; code allows all authed roles.
  { label: 'POST /requests', method: 'POST', url: '/api/v1/requests', invoke: reqCreate, allow: ALL },
  { label: 'GET /requests/[id]', method: 'GET', url: `/api/v1/requests/${ID}`, invoke: withId(reqGet), allow: ALL },
  { label: 'POST /requests/[id]/approve', method: 'POST', url: `/api/v1/requests/${ID}/approve`, invoke: withId(reqApprove), allow: ['ADMIN', 'EDITOR'] },
  { label: 'POST /requests/[id]/reject', method: 'POST', url: `/api/v1/requests/${ID}/reject`, invoke: withId(reqReject), allow: ['ADMIN', 'EDITOR'] },
  // Fulfilment remains ADMIN-only.
  { label: 'POST /requests/[id]/fulfil', method: 'POST', url: `/api/v1/requests/${ID}/fulfil`, invoke: withId(reqFulfil), allow: ['ADMIN'] },
  { label: 'POST /requests/[id]/cancel', method: 'POST', url: `/api/v1/requests/${ID}/cancel`, invoke: withId(reqCancel), allow: ALL },

  { label: 'GET /users', method: 'GET', url: '/api/v1/users', invoke: userList, allow: ['ADMIN'] },
  { label: 'POST /users', method: 'POST', url: '/api/v1/users', invoke: userCreate, allow: ['ADMIN'] },

  // docs/06 originally said VIEWER (not EDITOR); code allows ADMIN + EDITOR.
  { label: 'GET /audit-logs', method: 'GET', url: '/api/v1/audit-logs', invoke: auditList, allow: ['ADMIN', 'EDITOR'] },

  { label: 'GET /settings/notifications', method: 'GET', url: '/api/v1/settings/notifications', invoke: settingsGet, allow: ['ADMIN'] },
  { label: 'PUT /settings/notifications', method: 'PUT', url: '/api/v1/settings/notifications', invoke: settingsPut, allow: ['ADMIN'] },
];

const BASE = 'http://localhost:7000';

beforeAll(resetDatabase);

describe('RBAC matrix (route-guard layer)', () => {
  it('covers a non-empty policy table', () => {
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('$label enforces its role guard', async (ep) => {
    for (const role of ALL) {
      mockSession.actor = actorWithRole(role);
      const res = await ep.invoke(makeRequest(ep.method, BASE + ep.url));
      if (ep.allow.includes(role)) {
        // Role passed the guard; any non-auth status (200/201/204/404/422) is fine.
        expect([401, 403], `${role} should pass ${ep.label}`).not.toContain(res.status);
      } else {
        expect(res.status, `${role} should be forbidden on ${ep.label}`).toBe(403);
      }
    }

    // Unauthenticated requests are always rejected.
    mockSession.actor = null;
    const res = await ep.invoke(makeRequest(ep.method, BASE + ep.url));
    expect(res.status, `anonymous should be 401 on ${ep.label}`).toBe(401);
  });
});
