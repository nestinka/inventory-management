# 13 — AI-Agent Executable Implementation Tasks

This is the work queue. Each task is self-contained — a coding agent can pick one up cold, given this repo, and produce a PR. Tasks reference the design docs (01–12) for context.

## Status (as of 2026-05-19)
- Phase 0 ✅ Foundations — Complete
- Phase 1 ✅ Catalogue — Complete
- Phase 2 ✅ Inventory & stock adjustments — Complete
- Phase 3 ✅ Requests & approvals — Complete
- Phase 4 ✅ Notifications — Complete
- Phase 5 ✅ Reporting & audit explorer — Complete
- Phase 6 ✅ Hardening — Complete (T6.4 deferred pending external pen-test)

---

**Conventions for every task**:
- Write tests alongside the change (see `docs/10-testing-strategy.md`).
- Update docs if the contract changes.
- Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration` before opening the PR.
- Never bypass RBAC; never touch `current_stock` outside the `stock` module.
- Never `UPDATE` or `DELETE` from `audit_logs`, `stock_adjustments`, or `request_status_events`.

---

## Phase 0 — Foundations

### T0.1 — Bootstrap the Next.js + Prisma project
- Scope: `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind/PostCSS configs, ESLint, Prettier, Vitest config, Playwright config.
- Acceptance: `pnpm install && pnpm dev` boots a blank page; `pnpm test` runs (no tests yet ok).
- Files: project root.

### T0.2 — Prisma schema + initial migration
- Scope: write `prisma/schema.prisma` per [03-database-design.md](./03-database-design.md). Generate initial migration. Add `prisma/seed.ts`.
- Acceptance: `pnpm prisma migrate dev` creates tables; `pnpm db:seed` inserts the seed fixture; reseeding is idempotent.

### T0.3 — Auth: NextAuth credentials + RBAC plumbing
- Scope: `src/server/auth/options.ts`, `app/api/auth/[...nextauth]/route.ts`, login page, session typing, `requireRole` helper, `RoleGate` component.
- Acceptance: seeded admin can log in via `/login`; session JSON contains `role`; `requireRole` unit-tested.

### T0.4 — App shell layout (responsive)
- Scope: `(app)/layout.tsx` with sidebar/topbar/bottom-tabs, theme variables, `<UserMenu>`. Pull `next-themes` if dark mode toggle is desired (off by default).
- Acceptance: layout renders correctly at 360 px and 1440 px; sidebar collapses on `<md`.

### T0.5 — Logging, error handling, env validation
- Scope: `src/server/lib/logger.ts` (pino), `errors.ts` (`ApiError`, mapper to JSON), `src/env.ts` (zod). Replace any `console.log` with logger.
- Acceptance: malformed env throws on boot with a precise message; all route handlers return the standard error envelope.

### T0.6 — Docker Compose stack + Dockerfile
- Scope: `docker-compose.yml` (postgres, mailhog, app), multi-stage `Dockerfile`, `.dockerignore`, `.env.example`.
- Acceptance: `docker compose up -d` boots all three containers; app reachable on `http://localhost:3000`.

### T0.7 — CI baseline
- Scope: `.github/workflows/ci.yml` running lint, typecheck, unit, integration jobs.
- Acceptance: PRs run CI and block on failure.

---

## Phase 1 — Catalogue

### T1.1 — Categories module
- Scope: `src/server/modules/categories/{domain,dto,repo,service,index}.ts`. CRUD with soft-delete. Audit writes (`category.*`) inside the service tx.
- Acceptance: unit tests for service; integration tests for repo against testcontainers.

### T1.2 — Items module
- Scope: same shape as categories. Includes `stockState` derivation.
- Acceptance: creating an item with an invalid body (e.g. missing `name`) returns `VALIDATION_FAILED`; ADMIN and EDITOR may create items.

### T1.3 — Categories & items API routes
- Scope: route handlers under `app/api/v1/categories` and `app/api/v1/items` per [04-api-specifications.md](./04-api-specifications.md). Use a shared `withRoute(handler)` helper to wire session, RBAC, validation, logging, error mapping.
- Acceptance: integration tests cover happy path, RBAC rejection, validation failure for each verb.

### T1.4 — Catalogue UI (admin)
- Scope: `/catalogue/items` and `/catalogue/categories` list pages with create/edit forms (`react-hook-form` + zod). Use `DataTable` primitive.
- Acceptance: admin can full-CRUD on both; editor sees the pages 403 (or hidden in nav).

### T1.5 — Inventory list (read for all roles)
- Scope: `/inventory/page.tsx` with filters: text search, category, status, stock state, near-expiry days. Server component, server-side pagination.
- Acceptance: list renders 50 items < 1 s on a seeded 10k DB.

---

## Phase 2 — Inventory & stock adjustments

### T2.1 — Stock module
- Scope: `src/server/modules/stock/`. `adjust(input, actor, tx?)` does the row lock + update + history + audit + outbox event in a single transaction. Validates `delta != 0` and `currentStock + delta >= 0`.
- Acceptance: concurrent adjust unit test using `Promise.all` proves serialisation; emits `item.lowStock` when crossing the threshold.

### T2.2 — `POST /api/v1/stock/adjust` and `/stock/adjustments`
- Scope: route handlers. Supports `Idempotency-Key` header (store key + response in a small `idempotency_keys` table for 24h).
- Acceptance: replay returns the original response; new key produces a new adjustment.

### T2.3 — `StockAdjuster` component
- Scope: `src/components/inventory/stock-adjuster.tsx` (client). `+`/`−` buttons, qty preview, reason dialog (Sheet on mobile, Dialog on desktop), submit, optimistic UI rolled back on error.
- Acceptance: component test asserts payload shape; long-press on `−` repeats decrement.

### T2.4 — Item detail + history timeline
- Scope: `/inventory/[itemId]/page.tsx` showing item meta, current stock badge, near-expiry pill, and a timeline of `stock_adjustments` with infinite scroll.
- Acceptance: timeline loads 100 entries in < 300 ms on seeded data.

### T2.5 — Mobile quick-adjust screen
- Scope: bottom-tab FAB → full-screen mobile sheet with item search + adjuster. Two taps from launch to a successful adjustment.
- Acceptance: usability checked at 360 px; touch targets ≥ 44 px verified.

---

## Phase 3 — Requests & approvals

### T3.1 — Requests module + status machine
- Scope: `src/server/modules/requests/`. Methods: `create`, `cancel`, `approve`, `reject`, `fulfil`. Each transitions status, writes `request_status_events`, writes audit, and emits an event. Fulfilment calls `stockService.adjustMany` inside the tx.
- A line may reference an existing item (`itemId`) **or** propose a non-catalogue item (`newItem: { name, unitOfMeasure, categoryId }`, stored on the line as `custom_*`). On approval, an approved (`approvedQty > 0`) proposed line is promoted into a real catalogue item (0 stock, `item.create` audit) and linked, then fulfils normally.
- Acceptance: state-machine matrix tested exhaustively (every from→to and every forbidden transition); a proposed line is stored unlinked on create and promoted to a real item on approval.

### T3.2 — Requests API
- Scope: routes per spec. ADMIN and EDITOR may read all requests; VIEWER reads are owner-scoped.
- Acceptance: a viewer cannot view another user's request via API (integration test asserts 403 `FORBIDDEN`); an editor can read any request (200).

### T3.3 — Requests UI: list + new request
- Scope: `/requests` with status filter chips; `/requests/new` multi-line form (add/remove lines, item picker with current stock visible). The picker also offers "Request '<query>' as a new item", revealing name + unit + category fields for items not yet in the catalogue.
- Acceptance: submitting empty form fails validation; over-allocating a line over current stock is allowed (request still submits — admins may reject); a new-item line requires name + unit + category and renders with a "New" badge on the detail page until approval promotes it.

### T3.4 — Request detail with approval / fulfil panel
- Scope: `/requests/[id]` shows lines, status badge, status timeline, and a role-gated action bar (approve / reject / cancel / fulfil).
- Acceptance: approval respects `approvedQty <= requestedQty`; fulfilment respects `fulfilledQty <= approvedQty`; partial fulfilment renders correctly.

---

## Phase 4 — Notifications

### T4.1 — Event bus + outbox dispatcher
- Scope: `src/server/events/{bus,registry,dispatcher}.ts` and `event_outbox` migration (covered in T0.2). Dispatcher runs as a setInterval at boot, opt-out via env for tests.
- Acceptance: emit → row in outbox; dispatcher polls and marks dispatched; failures back off and retry up to 10 times.

### T4.2 — Email subscriber + nodemailer transport
- Scope: `src/server/lib/mail/`. Templates for the seven topics (React-email). SMTP config from env.
- Acceptance: dev: emails captured in Mailhog UI; payload matches template output snapshot.

### T4.3 — Audit & inbox subscribers
- Scope: `AuditSubscriber` (synchronous via service helper — see §audit doc), `InboxSubscriber` writing `notifications` rows.
- Acceptance: every emitted event with a user recipient produces an `audit_logs` row and an inbox row.

### T4.4 — Scanners
- Scope: `node-cron` jobs for low-stock (every 15 min) and near-expiry (09:00 daily). Use a `notification_dedup` table to suppress repeats within 24h.
- Acceptance: integration test drives the scan with fixtures and asserts events emitted; redoing within 24h emits nothing.

### T4.5 — In-app inbox UI
- Scope: topbar bell with unread badge; sheet listing recent notifications; mark-read interaction.
- Acceptance: real-time within the request (no websockets in v1 — refresh on action).

---

## Phase 5 — Reporting & audit explorer

### T5.1 — Reports module + endpoints
- Scope: `src/server/modules/reports/service.ts` with one method per report. `format=csv` support via a streaming response.
- Acceptance: each endpoint has an integration test asserting structure & RBAC.

### T5.2 — Dashboard
- Scope: `/page.tsx` dashboard with the six cards listed in [12-roadmap.md](./12-roadmap.md). Cards link to filtered list views.
- Acceptance: dashboard responds < 1 s on the seeded DB; cards have skeleton loaders.

### T5.3 — Charts pages
- Scope: consumption (line), department usage (stacked bar), request analytics (kpis + table).
- Acceptance: charts respect `prefers-reduced-motion`; have textual summaries for screen readers.

### T5.4 — Audit explorer UI
- Scope: `/audit` with filters and a row drill-in showing the `diff` rendered key-by-key.
- Acceptance: admin & editor can access; viewer cannot.

---

## Phase 6 — Hardening

### T6.1 — Rate limiting
- Scope: middleware around auth routes (5/min/IP) and api routes (60/min/user). Token bucket in Postgres (or in-memory with `lru-cache` for v1 single-replica).
- Acceptance: 6th login attempt within a minute returns 429.

### T6.2 — Lockout + password reset
- Scope: increment `failed_login_count`; set `locked_until` after 10 failures. Reset flow with signed token email.
- Acceptance: locked user cannot log in even with correct password until window passes or admin resets.

### T6.3 — Accessibility pass
- Scope: WCAG 2.1 AA audit. Fix focus order, ARIA labels, contrast, motion.
- Acceptance: `axe` automated audit clean on every public page in Playwright.

### T6.4 — Pen-test remediation
- Scope: address findings from external review.
- Acceptance: clean re-test.

### T6.5 — Runbooks & release `v1.0`
- Scope: `docs/runbooks/*`, tag `v1.0`, smoke deploy.

---

## How an agent should pick up a task

1. Read the task entry and the linked design docs.
2. Re-read `docs/02-system-architecture.md` §2 for the module contract you'll touch.
3. Write the failing tests first (unit, then integration).
4. Implement the code.
5. Run `pnpm lint && pnpm typecheck && pnpm test`. Fix until green.
6. Update the relevant design doc if behaviour changed.
7. Open a PR titled `T<x>.<y> — <task name>` with a checklist linking acceptance criteria.

## Task-template prompt (for fresh agent invocations)

> You are implementing `T<x>.<y>` from `docs/13-agent-tasks.md` of the `inventory-management` repo. Read that task and any docs it references. Implement the change end-to-end (code + tests + docs as needed). Stick to the module boundaries described in `docs/02-system-architecture.md` §2. Don't introduce new dependencies without justification in the PR. Run lint/typecheck/test before reporting done; if anything fails, fix the root cause rather than skipping.
