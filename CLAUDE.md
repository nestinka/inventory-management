# CLAUDE.md — Inventory Management System

## Commands

```bash
pnpm dev               # start dev server on :7000
pnpm test:unit         # vitest unit tests
pnpm test:integration  # vitest integration tests (needs Postgres)
pnpm test:component    # vitest component tests
pnpm test:e2e          # playwright e2e
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint
pnpm db:migrate        # prisma migrate dev
pnpm db:deploy         # prisma migrate deploy (prod / CI)
pnpm db:seed           # baseline seed: admin + categories (idempotent, safe in prod)
pnpm db:seed:dev       # dev-only: adds editor/viewer + demo items + sample request
```

## Architecture rules (non-negotiable)

1. **Barrel imports only.** Outside `src/server/modules/<name>/`, always import from `@/server/modules/<name>` — never from `*/repo`, `*/service`, `*/domain`, etc. The ESLint rule enforces this.
2. **No direct `current_stock` writes.** Stock mutations go through `stockService.adjust()` only. Never write to `items.current_stock` directly.
3. **Audit writes are synchronous and transactional.** Call `writeAudit(tx, ...)` inside `prisma.$transaction`. No audit = no business write.
4. **Append-only history.** Never `update` or `delete` rows from `audit_logs`, `stock_adjustments`, or `request_status_events`.
5. **RBAC at two layers.** Route guards (`requireRole`) AND service guards. Never skip either.
6. **Zod validates all API input.** Pass bodies through the module's `*Dto` schema before touching any service.

## Module structure

Every module under `src/server/modules/<name>/` ships at minimum:
- `dto.ts` — zod schemas for I/O
- `service.ts` — business logic, events, audit (DB calls inline by default)
- `index.ts` — public barrel (only this is importable by API routes)

Two optional files exist when a module's complexity earns them:
- `domain.ts` — pure types and value objects beyond what `@prisma/client` exposes (e.g., `deriveStockState` in the items module)
- `repo.ts` — extracted only when more than one service file would otherwise touch the DB, or when the queries are large enough to deserve their own file

`categories`, `items`, and `users` use the full five-file layout; `audit`, `auth`, `notifications`, `reports`, `requests`, `settings`, and `stock` keep their DB calls inline in `service.ts`. The barrel-import rule below applies in both cases.

## Testing expectations

- Every new service method → unit test for happy path + at least one error path.
- Every new API route → integration test for happy path + RBAC rejection.
- Every new audit action → entry in `EXPECTED_AUDIT_ACTIONS` in `tests/unit/audit-coverage.spec.ts` (the gate fails on any unregistered verb).
- Every new event topic → entry in `EXPECTED_EVENT_TOPICS` in `tests/unit/notifications-coverage.spec.ts` (the gate fails on any unregistered or unwired topic).

## Seed credentials (dev)

```
admin@inventory.local  / Admin1234!   (ADMIN)
editor@inventory.local / Editor1234!  (EDITOR)
viewer@inventory.local / Viewer1234!  (VIEWER)
```

## Env

Copy `.env.example` to `.env`. Defaults work with `docker compose up -d postgres mailhog`.

## Task backlog

See `docs/13-agent-tasks.md` for the full AI-agent task queue.
Status: **all phases (0–6) complete and shipped as v1.0**. The only open backlog item is **T6.4 (pen-test remediation)**, deferred pending an external penetration-test engagement. Future scope lives in `docs/12-roadmap.md` under "Beyond v1".
