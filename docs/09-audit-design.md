# 09 — Audit Design

## 1. Principles

1. **Every state-changing action is logged**, with the *who*, *what*, *when*, *where*, and a structured *diff*.
2. **Append-only at the application boundary.** DB grant for the runtime user is `INSERT, SELECT` only on `audit_logs`.
3. **In the same transaction as the business write.** No business commit without its audit row.
4. **Filterable, exportable, and human-readable.** Compliance auditors should be able to answer "show me everything user X did to item Y in March" in under a minute.

## 2. Action vocabulary

`action` follows `<aggregate>.<verb>`:

| Aggregate | Verbs |
|---|---|
| `auth` | `login`, `login.failed`, `logout`, `password.reset.request`, `password.reset.confirm`, `lockout` |
| `user` | `create`, `update`, `activate`, `deactivate`, `role.change`, `delete` |
| `category` | `create`, `update`, `delete` |
| `item` | `create`, `update`, `delete`, `restore` |
| `stock` | `adjust` |
| `request` | `create`, `approve`, `reject`, `cancel`, `fulfil` |

New verbs require a row in `tests/integration/audit-coverage.spec.ts` — CI fails on undocumented actions.

## 3. Row schema (recap)

```
audit_logs(
  id, actor_id, action, target_type, target_id,
  diff jsonb,        -- { before, after } for entity changes
  ip inet, user_agent text, request_id text,
  created_at timestamptz default now()
)
```

`diff` shapes:
- **Entity update**: `{ before: { name: "X", reorderThreshold: 5 }, after: { name: "X", reorderThreshold: 8 } }` — only changed fields included.
- **Entity create**: `{ after: <full row minus secrets> }`.
- **Entity delete (soft)**: `{ before: <row>, after: { deletedAt: <ts> } }`.
- **Stock adjust**: `{ delta, balanceBefore, balanceAfter, reason, note }`.
- **Request transition**: `{ from: "PENDING", to: "APPROVED", lines: [...] }`.
- **Auth events**: `{ email }`; passwords NEVER written.

## 4. Redaction

A central `sanitize()` helper strips fields by key (`password`, `passwordHash`, `token`, `secret`, `apiKey`) before serialising into `diff`. Unit-tested in `tests/unit/audit-sanitize.spec.ts`.

## 5. Writing logs

Services emit a domain event; an `AuditSubscriber` writes the log row. To keep this *in-transaction*, services have two options:

1. **Direct in-line write** — for actions where the audit content is fully known at the call site (most CRUD).
2. **Outbox-driven write** — for actions composed of multiple steps; the audit row is still produced synchronously in the same tx (via the outbox table marked `dispatch: 'inline'`).

In practice we standardise on option 1. The outbox is for *external* side effects (email, future webhooks). Audit rows are mandatory and synchronous.

## 6. Helper API (services)

```ts
// src/server/lib/audit.ts
export async function writeAudit(tx: Tx, params: {
  actor: { id: string } | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  diff?: Diff;
  ctx?: AuditContext;       // ip, ua, requestId
}): Promise<void>
```

Always called inside a `prisma.$transaction(async tx => { ... writeAudit(tx, ...) })`.

## 7. Read paths

`GET /api/v1/audit-logs` supports:

- `actorId` (uuid)
- `targetType` + optional `targetId`
- `action` (exact or prefix, e.g. `request.*`)
- `from` / `to` (ISO timestamps)
- `q` — free text over `diff::text` (with caveat in §9)
- `format=csv` for export

Cursor-based pagination (id descending) is fast thanks to `(created_at DESC)` and `(target_type, target_id, created_at DESC)` indexes.

## 8. UI surface

`/audit` page (`(app)/audit/page.tsx`):

- Filter bar: user picker, target-type select, action select, date range.
- Table: time, actor, action, target, summary.
- Row click → side sheet with the full `diff` rendered as a two-column key-by-key diff.
- "Export CSV" button posts the same filters to `/api/v1/audit-logs?format=csv`.

## 9. Performance & scale

- For 10k actions/day, a single Postgres table handles years. We index for the dominant access patterns.
- At v1.1, partition `audit_logs` by month (`PARTITION BY RANGE (created_at)`) and add a retention job to drop partitions older than 7 years (or move to cold storage).
- Free-text search over `diff::text` is fine at small scale; if it becomes hot, add a `tsvector` GIN index on extracted fields.

## 10. Tamper resistance

- DB-level: `REVOKE UPDATE, DELETE ON audit_logs FROM app_runtime`.
- App-level: there is no `auditRepo.update` or `delete` — the repo only exposes `insert` and `find*`.
- Optional (v1.1): per-row hash chain (`prev_hash`, `row_hash`) to detect any out-of-band tampering at the DB.

## 11. PII & data subject requests

- A subject access request can be answered with: `SELECT * FROM audit_logs WHERE actor_id = $1 OR diff->>'email' = $2`.
- A right-to-erasure request is handled by **redacting** PII in place (`diff = jsonb_set(diff, '{after,email}', '"REDACTED"')`) rather than deleting rows, preserving the auditability of the action while removing the personal identifier. The redaction itself is an audit event (`user.redact`).
