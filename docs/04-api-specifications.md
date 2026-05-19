# 04 — API Specifications

All endpoints are Next.js Route Handlers under `src/app/api/**`. The full OpenAPI 3.1 contract is generated from zod schemas via `zod-to-openapi` and served at `/api/openapi.json` and `/docs/api` (Swagger UI). What follows is the human-facing summary.

## 1. Conventions

- Base path: `/api/v1` (route group folder in app router).
- All requests/responses are JSON; `Content-Type: application/json`.
- Authentication: NextAuth session cookie. Service-to-service callers may use a `Bearer <PAT>` token (deferred to v1.1).
- Errors: a single shape — `{ "error": { "code": string, "message": string, "details"?: any } }`.
- Standard status codes:
  - `200 OK` on read
  - `201 Created` on create
  - `204 No Content` on delete
  - `400` validation / business rule violation
  - `401` missing/invalid auth
  - `403` insufficient role
  - `404` not found (or soft-deleted)
  - `409` conflict (stale update)
  - `422` zod validation failure (sub-case of 400, distinguished for clients)
  - `429` rate limit
  - `500` unexpected
- Pagination: cursor-based. Query: `?limit=20&cursor=<opaque>`. Response: `{ data, nextCursor }`.
- Sorting: `?sort=name:asc,createdAt:desc`.
- Filtering: explicit query params per endpoint (no generic filter DSL).
- Idempotency: state-changing endpoints accept `Idempotency-Key` header; replays within 24h return the original response.
- Rate limit: 60 rpm/user for general endpoints, 5 rpm/IP for `/api/v1/auth/*`.

## 2. Endpoints by module

### 2.1 Auth (`/api/auth/*`)

Handled by NextAuth.js route handler. Public surface:

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/callback/credentials` | Email + password login |
| POST | `/api/auth/signout` | Sign out |
| GET  | `/api/auth/session` | Current session payload |
| POST | `/api/v1/auth/password/reset/request` | Email a reset link |
| POST | `/api/v1/auth/password/reset/confirm` | Submit new password with token |

### 2.2 Users (`/api/v1/users`) — ADMIN only

| Method | Path | Role |
|---|---|---|
| GET | `/users` | ADMIN |
| GET | `/users/:id` | ADMIN |
| POST | `/users` | ADMIN |
| PATCH | `/users/:id` | ADMIN |
| DELETE | `/users/:id` | ADMIN (soft-delete) |
| POST | `/users/:id/role` | ADMIN |
| POST | `/users/:id/activate` | ADMIN |
| POST | `/users/:id/deactivate` | ADMIN |

### 2.3 Categories (`/api/v1/categories`)

| Method | Path | Role |
|---|---|---|
| GET | `/categories` | any authenticated |
| GET | `/categories/:id` | any authenticated |
| POST | `/categories` | ADMIN |
| PATCH | `/categories/:id` | ADMIN |
| DELETE | `/categories/:id` | ADMIN |

Body (POST):
```json
{ "name": "Networking", "description": "Switches, routers, cabling" }
```

### 2.4 Items (`/api/v1/items`)

| Method | Path | Role |
|---|---|---|
| GET | `/items` | any authenticated |
| GET | `/items/:id` | any authenticated |
| POST | `/items` | ADMIN |
| PATCH | `/items/:id` | ADMIN |
| DELETE | `/items/:id` | ADMIN |
| GET | `/items/:id/history` | any authenticated |

Query for `GET /items`:
- `q` — text search across name
- `categoryId`
- `status` — `ACTIVE | INACTIVE | DISCONTINUED`
- `stockState` — `HEALTHY | LOW | OUT`
- `nearExpiryDays` — items expiring within N days
- `limit`, `cursor`, `sort`

Response item shape:
```json
{
  "id": "uuid",
  "name": "Dell Latitude 7430",
  "description": "...",
  "unitOfMeasure": "pcs",
  "categoryId": "uuid",
  "category": { "id": "uuid", "name": "Laptops" },
  "currentStock": 12,
  "reorderThreshold": 5,
  "expiryDate": null,
  "status": "ACTIVE",
  "stockState": "HEALTHY",
  "createdAt": "2026-05-18T10:00:00Z",
  "updatedAt": "2026-05-18T10:00:00Z"
}
```

`stockState` is computed server-side from `currentStock` vs `reorderThreshold`.

### 2.5 Stock adjustments (`/api/v1/stock`)

| Method | Path | Role |
|---|---|---|
| POST | `/stock/adjust` | EDITOR, ADMIN |
| GET | `/stock/adjustments` | any authenticated (filters: itemId, actorId, from, to) |

Body (POST `/stock/adjust`):
```json
{
  "itemId": "uuid",
  "delta": -2,
  "reason": "CONSUMPTION",
  "note": "Issued to helpdesk for ticket #4421"
}
```

Business rules:
- `delta != 0`
- `currentStock + delta >= 0` (otherwise 409 `STOCK_BELOW_ZERO`)
- `reason` is required and must be a valid enum.
- Writing endpoint accepts `Idempotency-Key` to make mobile retry-safe.

### 2.6 Requests (`/api/v1/requests`)

| Method | Path | Role |
|---|---|---|
| GET | `/requests` | EDITOR (own), ADMIN (all), VIEWER (read-only all) |
| GET | `/requests/:id` | as above |
| POST | `/requests` | EDITOR, ADMIN |
| POST | `/requests/:id/cancel` | requester (if PENDING) or ADMIN |
| POST | `/requests/:id/approve` | ADMIN |
| POST | `/requests/:id/reject` | ADMIN |
| POST | `/requests/:id/fulfil` | ADMIN |

Body (POST `/requests`):
```json
{
  "reason": "Re-stocking helpdesk drawer",
  "lines": [
    { "itemId": "uuid", "requestedQty": 5 },
    { "itemId": "uuid", "requestedQty": 1 }
  ]
}
```

Body (POST `/requests/:id/approve`):
```json
{
  "lines": [
    { "lineId": "uuid", "approvedQty": 5 },
    { "lineId": "uuid", "approvedQty": 0 }
  ],
  "note": "Switches approved; second item out of stock"
}
```

Body (POST `/requests/:id/fulfil`):
```json
{
  "lines": [{ "lineId": "uuid", "fulfilledQty": 5 }]
}
```

Fulfilment is the only action that decrements stock. Each fulfilled line writes a `stock_adjustments` row with `reason='FULFILMENT'` and `requestId=:id`.

### 2.7 Audit logs (`/api/v1/audit-logs`)

| Method | Path | Role |
|---|---|---|
| GET | `/audit-logs` | ADMIN, VIEWER |

Query params: `actorId`, `targetType`, `targetId`, `action`, `from`, `to`, `limit`, `cursor`.

### 2.8 Reports (`/api/v1/reports`)

| Method | Path | Role |
|---|---|---|
| GET | `/reports/inventory-snapshot` | any authenticated |
| GET | `/reports/low-stock` | any authenticated |
| GET | `/reports/out-of-stock` | any authenticated |
| GET | `/reports/near-expiry?days=30` | any authenticated |
| GET | `/reports/consumption?from=&to=&groupBy=day\|week` | any authenticated |
| GET | `/reports/department-usage?from=&to=` | ADMIN, VIEWER |
| GET | `/reports/request-analytics?from=&to=` | ADMIN, VIEWER |

All reports support `?format=json` (default) or `?format=csv`.

### 2.9 Notifications

| Method | Path | Role |
|---|---|---|
| GET | `/notifications` | authenticated (own) |
| POST | `/notifications/:id/read` | authenticated (own) |
| POST | `/notifications/read-all` | authenticated (own) |

### 2.10 Meta

| Method | Path | Role |
|---|---|---|
| GET | `/healthz` | public |
| GET | `/readyz` | public |
| GET | `/openapi.json` | public |

## 3. Versioning

URI versioning (`/api/v1/...`). Breaking changes increment the prefix. Internal modules speak their own typed contracts (zod-inferred TS types) — versioning concerns only stop at the route boundary.

## 4. Error catalogue (excerpt)

| code | http | meaning |
|---|---|---|
| `AUTH_REQUIRED` | 401 | no session |
| `FORBIDDEN` | 403 | role insufficient |
| `VALIDATION_FAILED` | 422 | zod parse failed; `details` lists field errors |
| `NOT_FOUND` | 404 | entity absent or soft-deleted |
| `STOCK_BELOW_ZERO` | 409 | adjustment would push stock < 0 |
| `STALE_REQUEST` | 409 | optimistic-lock mismatch |
| `RATE_LIMITED` | 429 | too many requests |
| `INTERNAL` | 500 | unexpected; logged with request id |

## 5. OpenAPI generation

Each module's `dto.ts` registers its zod schemas with `@asteasolutions/zod-to-openapi`. A startup helper composes a single `OpenAPIObject` exposed at `/api/openapi.json`. Swagger UI is served at `/docs/api`. Contract tests in `tests/integration/openapi.spec.ts` assert that every handler is covered by a documented schema.
