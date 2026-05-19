# 03 — Database Design

PostgreSQL 16. All schemas managed by Prisma migrations.

## 1. Entity-relationship overview

```
User ─┬──< StockAdjustment >── Item >── Category
      ├──< Request >─< RequestLine >── Item
      ├──< AuditLog
      └─ Department (optional FK)

Item 1───* StockAdjustment   (history)
Item 1───* RequestLine
Request 1───* RequestLine
Request 1───* RequestStatusEvent (audit-friendly status timeline)

EventOutbox  (decoupled from domain; powers async dispatch)
```

## 2. Tables

### 2.1 `users`
| col | type | notes |
|---|---|---|
| id | `uuid` PK | `gen_random_uuid()` default |
| email | `citext` UNIQUE | case-insensitive |
| name | `text` |
| password_hash | `text` | bcrypt cost 12 |
| role | `user_role` enum (`ADMIN`,`EDITOR`,`VIEWER`) |
| department_id | `uuid` FK → departments.id, nullable |
| is_active | `boolean` default `true` |
| last_login_at | `timestamptz` nullable |
| failed_login_count | `int` default 0 |
| locked_until | `timestamptz` nullable |
| created_at | `timestamptz` default `now()` |
| updated_at | `timestamptz` |
| deleted_at | `timestamptz` nullable | **soft delete** |

Indexes: `email`, partial `(role) WHERE deleted_at IS NULL`.

### 2.2 `departments`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| name | `text` UNIQUE |
| created_at / updated_at / deleted_at | timestamps |

### 2.3 `categories`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| name | `text` UNIQUE per-tenant (just UNIQUE v1) |
| description | `text` |
| created_at / updated_at / deleted_at |

### 2.4 `items`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| sku | `citext` UNIQUE |
| name | `text` |
| description | `text` |
| unit_of_measure | `text` (e.g. "pcs", "m", "box") |
| category_id | `uuid` FK → categories.id |
| current_stock | `int` ≥ 0 |
| reorder_threshold | `int` ≥ 0 |
| expiry_date | `date` nullable |
| status | `item_status` enum (`ACTIVE`,`INACTIVE`,`DISCONTINUED`) default `ACTIVE` |
| created_at / updated_at / deleted_at |
| created_by_id | `uuid` FK → users.id |

Indexes:
- `(category_id)`
- `(status) WHERE deleted_at IS NULL`
- Partial index for low-stock query: `(reorder_threshold) WHERE deleted_at IS NULL AND status = 'ACTIVE'`
- `(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL` — for near-expiry scan

`current_stock` is **always** mutated through a service method that also writes a `stock_adjustments` row in the same transaction. Direct UPDATEs to `current_stock` outside that path are forbidden by code review.

### 2.5 `stock_adjustments` (append-only history)
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| item_id | `uuid` FK → items.id |
| delta | `int` (signed; positive = add, negative = remove) |
| balance_after | `int` (snapshot of `items.current_stock` after this adjustment) |
| reason | `adjustment_reason` enum (`DAMAGE`,`EXPIRY`,`AUDIT_CORRECTION`,`CONSUMPTION`,`MANUAL_OVERRIDE`,`RECEIVED`,`FULFILMENT`) |
| note | `text` nullable |
| actor_id | `uuid` FK → users.id |
| request_id | `uuid` FK → requests.id nullable (set when adjustment is the result of fulfilment) |
| created_at | `timestamptz` |

Indexes: `(item_id, created_at DESC)` for timeline reads.

No `updated_at`, no soft-delete — append-only.

### 2.6 `requests`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| requester_id | `uuid` FK → users.id |
| department_id | `uuid` FK → departments.id nullable |
| status | `request_status` enum (`PENDING`,`APPROVED`,`REJECTED`,`FULFILLED`,`CANCELLED`) default `PENDING` |
| reason | `text` (justification) |
| approver_id | `uuid` FK → users.id nullable |
| approved_at | `timestamptz` nullable |
| fulfilled_at | `timestamptz` nullable |
| created_at / updated_at |

### 2.7 `request_lines`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| request_id | `uuid` FK → requests.id |
| item_id | `uuid` FK → items.id |
| requested_qty | `int` > 0 |
| approved_qty | `int` ≥ 0 nullable (null until decision) |
| fulfilled_qty | `int` ≥ 0 default 0 |

Indexes: `(request_id)`, `(item_id)`.

### 2.8 `request_status_events`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| request_id | `uuid` FK → requests.id |
| from_status | enum nullable (null = initial) |
| to_status | enum |
| actor_id | `uuid` FK → users.id |
| note | `text` nullable |
| created_at | `timestamptz` |

### 2.9 `audit_logs`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| actor_id | `uuid` FK → users.id nullable (null for system actions) |
| action | `text` (e.g. `item.update`, `auth.login`, `request.approve`) |
| target_type | `text` (`item`,`category`,`user`,`request`,`stock`,`auth`) |
| target_id | `text` nullable |
| diff | `jsonb` nullable (`{ before: {...}, after: {...} }`) |
| ip | `inet` nullable |
| user_agent | `text` nullable |
| request_id | `text` nullable (correlates to log line) |
| created_at | `timestamptz` |

Indexes:
- `(created_at DESC)`
- `(actor_id, created_at DESC)`
- `(target_type, target_id, created_at DESC)`
- `(action, created_at DESC)`

**Append-only**: DB grant for the application user is `INSERT, SELECT` only on this table.

### 2.10 `event_outbox`
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| topic | `text` (e.g. `item.lowStock`) |
| payload | `jsonb` |
| created_at | `timestamptz` |
| dispatched_at | `timestamptz` nullable |
| attempts | `int` default 0 |
| last_error | `text` nullable |

Index: partial `(created_at) WHERE dispatched_at IS NULL` for cheap dispatcher polling.

### 2.11 `notifications` (per-user inbox, optional surface in UI)
| col | type | notes |
|---|---|---|
| id | `uuid` PK |
| user_id | `uuid` FK → users.id |
| topic | `text` |
| payload | `jsonb` |
| read_at | `timestamptz` nullable |
| created_at | `timestamptz` |

## 3. Enums

```sql
CREATE TYPE user_role AS ENUM ('ADMIN','EDITOR','VIEWER');
CREATE TYPE item_status AS ENUM ('ACTIVE','INACTIVE','DISCONTINUED');
CREATE TYPE adjustment_reason AS ENUM ('DAMAGE','EXPIRY','AUDIT_CORRECTION','CONSUMPTION','MANUAL_OVERRIDE','RECEIVED','FULFILMENT');
CREATE TYPE request_status AS ENUM ('PENDING','APPROVED','REJECTED','FULFILLED','CANCELLED');
```

## 4. Soft-delete strategy

- All "catalogue" tables (`users`, `departments`, `categories`, `items`) have `deleted_at timestamptz NULL`.
- Repositories filter `deleted_at IS NULL` by default; an explicit `includeDeleted: true` option is required to bypass.
- History tables (`stock_adjustments`, `audit_logs`, `request_status_events`, `event_outbox`) **never** soft-delete.

## 5. Indexing rationale

| Query | Index |
|---|---|
| List items by category | `items(category_id) WHERE deleted_at IS NULL` |
| Low-stock scan | partial `items(reorder_threshold) WHERE deleted_at IS NULL AND status='ACTIVE'` (we then filter `current_stock < reorder_threshold` in WHERE) |
| Near-expiry scan | `items(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL` |
| Stock timeline | `stock_adjustments(item_id, created_at DESC)` |
| Audit by user | `audit_logs(actor_id, created_at DESC)` |
| Audit by item | `audit_logs(target_type, target_id, created_at DESC)` |
| Pending requests | `requests(status, created_at DESC)` |

## 6. Migrations & seed

- Prisma migrations live in `prisma/migrations/`, named `<timestamp>_<slug>`.
- `prisma db seed` runs `prisma/seed.ts`:
  - Creates 1 ADMIN, 1 EDITOR, 1 VIEWER user.
  - 3 departments, 4 categories, ~20 items spanning healthy / low / out-of-stock / near-expiry.
  - A handful of historical stock adjustments and one approved-but-unfulfilled request, for demo.
- Seed is **idempotent** — re-running it must not duplicate rows (uses `upsert` by natural keys).

## 7. DB user / grants (prod)

```sql
-- runtime user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
-- explicitly remove DELETE/UPDATE on append-only history
REVOKE UPDATE, DELETE ON audit_logs, stock_adjustments, request_status_events FROM app_runtime;
```

Migrations use a separate `app_migrator` user with full DDL.

## 8. Backup & retention

- `pg_dump` nightly, 30-day retention.
- Audit logs retained ≥ 7 years (configurable); partitioned by month from v1.1.
