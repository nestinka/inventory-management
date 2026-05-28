# 06 — RBAC Matrix

## 1. Roles

| Role | Description |
|---|---|
| `ADMIN` | Full control: catalogue CRUD, user management, approvals, audit access, all reports |
| `EDITOR` | Floor / helpdesk staff: stock adjustments, submits requests, views catalogue and own request history |
| `VIEWER` | Read-only — for finance, dept heads, auditors |

A user has exactly one role. Role changes are themselves audited (`auth.role.change`).

## 2. Resource × action × role matrix

Legend: ✅ allowed · ⚠ own-only · ❌ forbidden

| Resource / Action | ADMIN | EDITOR | VIEWER |
|---|---|---|---|
| **Categories** | | | |
| List / view | ✅ | ✅ | ✅ |
| Create / update / delete | ✅ | ❌ | ❌ |
| **Items** | | | |
| List / view / history | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Update / delete | ✅ | ❌ | ❌ |
| **Stock adjustments** | | | |
| Adjust (+/-, with reason) | ✅ | ✅ | ❌ |
| View adjustment history | ✅ | ✅ | ✅ |
| **Requests** | | | |
| Create request | ✅ | ✅ | ✅ |
| View all requests | ✅ | ✅ | ❌ |
| View own request | ✅ | ✅ | ✅ |
| Cancel request | ⚠ any | ⚠ own & PENDING | ⚠ own & PENDING |
| Approve / reject | ✅ | ✅ | ❌ |
| Fulfil | ✅ | ❌ | ❌ |
| **Audit log** | | | |
| View / filter | ✅ | ✅ | ❌ |
| Export | ✅ | ✅ | ❌ |
| **Reports** | | | |
| Inventory / low-stock / out-of-stock / near-expiry / consumption | ✅ | ✅ | ✅ |
| Department-usage / request-analytics | ✅ | ❌ | ✅ |
| **Users** | | | |
| List / view / create / update / activate / deactivate / role-change | ✅ | ❌ | ❌ |
| View / edit own profile | ✅ | ✅ | ✅ |
| **Notifications** | | | |
| View own / mark read | ✅ | ✅ | ✅ |

## 3. Enforcement layers

1. **Route guard** — every state-changing handler calls `requireRole(ADMIN)` (or `requireRole([ADMIN, EDITOR])`). Returns 403 on mismatch.
2. **Service guard** — service methods accept an `actor` object and re-check (defence in depth). Some checks are owner-scoped, e.g. `requestsService.cancel(requestId, actor)` rejects EDITOR if they didn't author the request.
3. **UI guard** — `<RoleGate role="ADMIN">` and the session shape drive menu visibility. Never the sole gate.

## 4. Helpers (server)

```ts
// src/server/auth/rbac.ts
export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export function requireRole(allowed: Role | Role[], actor: { role: Role } | null) {
  if (!actor) throw new ApiError('AUTH_REQUIRED', 401);
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(actor.role)) throw new ApiError('FORBIDDEN', 403);
}

export function requireOwnerOrAdmin(ownerId: string, actor: { id: string; role: Role }) {
  if (actor.role === 'ADMIN' || actor.id === ownerId) return;
  throw new ApiError('FORBIDDEN', 403);
}
```

## 5. Helpers (client)

```tsx
// src/components/auth/role-gate.tsx
export function RoleGate({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { data } = useSession();
  const allowed = Array.isArray(role) ? role : [role];
  if (!data?.user || !allowed.includes(data.user.role as Role)) return null;
  return <>{children}</>;
}
```

## 6. Policy testing

For each role, a fixture in `tests/integration/rbac-matrix.spec.ts` enumerates every endpoint × role combination and asserts the matrix above. New endpoints **must** add a row before merge; CI flags omissions via a coverage assertion.

## 7. Future extensions

- Per-category permissions (e.g. "EDITOR can adjust only Consumables") — would shift to attribute-based policy; the `requireRole` helper would become `evaluatePolicy(action, subject, resource, env)`.
- Approval thresholds (auto-approve under X units) — modelled as policy, not role.
- SSO group → role mapping when OAuth lands.
