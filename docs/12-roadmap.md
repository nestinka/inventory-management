# 12 — Incremental Development Roadmap

Six phases, each shippable. Each phase ends with a green CI run, a working `docker compose up`, and updated docs.

## Phase 0 — Foundations  (≈ 1 sprint)

**Goal**: a deployable empty app with infra in place.

- Repo scaffold (Next.js 15, TS strict, Tailwind, ESLint, Prettier).
- Prisma + Postgres + base schema (users, departments).
- NextAuth credentials + bcrypt, login + logout + session.
- Layout shell (sidebar/topbar/bottom tabs).
- `pino` logger, error mapper, zod env validation.
- Vitest + Testing Library + Playwright skeletons.
- Docker Compose: app + postgres + mailhog.
- CI: lint + type + unit + integration.

**Done when**: an admin user (seeded) can log in, see an empty dashboard, log out. CI green.

## Phase 1 — Catalogue

**Goal**: admins can manage categories and items.

- Categories CRUD (service, repo, dto, API, page).
- Items CRUD with all attributes.
- Soft-delete behaviour + repo conventions.
- Audit log writes for category/item changes.
- Item list view: search, filter by category & status, paginate.
- RBAC enforcement; UI hides admin-only actions for editors.

**Done when**: admin can create 20 items across 4 categories; editor can read them; audit log shows the trail.

## Phase 2 — Inventory & stock adjustments

**Goal**: editors can adjust stock with reasons, on phone or desktop.

- `stock` module with `adjust` transactional method.
- `stock_adjustments` history table + service + repo.
- Inline `StockAdjuster` component (desktop) and quick-update mobile sheet.
- Reason dialog with enum, optional note, idempotency-key on POST.
- Per-item history timeline page.
- Stock-state badge (GREEN / YELLOW / RED) everywhere items render.
- Audit log writes per adjustment.

**Done when**: editor on a phone can pick an item, tap `−`, choose a reason, and see the stock decrease; history records it; audit log entry exists.

## Phase 3 — Requests & approvals

**Goal**: end-to-end request workflow.

- `requests` module with status machine and line items.
- `request_status_events` history.
- Editor: new-request form, list of own requests, cancel.
- Admin: pending queue, approval & rejection actions with notes.
- Fulfilment action that writes `FULFILMENT` stock adjustments transactionally.
- Audit log writes per state transition.

**Done when**: editor submits a 3-line request; admin approves with one line at 0; admin fulfils 2 lines; stock decremented exactly twice; requester sees `FULFILLED` (partial) badge.

## Phase 4 — Notifications

**Goal**: event-driven email + in-app inbox.

- `event_outbox` table + dispatcher loop with back-off.
- Subscribers: `AuditSubscriber` (inline), `EmailSubscriber`, `InboxSubscriber`.
- Nodemailer transport; React-email templates for the seven core topics.
- Low-stock & near-expiry scanners (`node-cron`) feeding the bus.
- Per-item 24h debounce for `item.lowStock`.
- In-app inbox sheet with unread badge.

**Done when**: dropping an item below threshold triggers exactly one admin email within ≤ 1 minute; redoing it within 24h sends nothing; near-expiry digest fires at 09:00 with all items in window.

## Phase 5 — Reporting & audit explorer

**Goal**: dashboards and the audit log UI.

- `/reports/*` endpoints (JSON + CSV).
- Dashboard cards (current inventory, low-stock count, out-of-stock count, near-expiry count, pending requests, recent audits).
- Consumption / department / request-analytics charts.
- `/audit` page with filters, row drill-in, CSV export.
- Performance pass: indexes verified, EXPLAIN plans saved as docs.

**Done when**: viewer can pull a CSV of all stock adjustments by Editor X in March; dashboard p95 < 1 s with 10k items.

## Phase 6 — Hardening & polish

**Goal**: production-readiness.

- Penetration test fixes.
- WCAG 2.1 AA audit on every page.
- Rate-limiting on `/api/auth/*` and `/api/v1/*`.
- Account lockout + password reset.
- Backup restore tested end-to-end.
- Documentation: runbooks, on-call playbook.
- E2E smoke tests for each role; perf test for catalogue list.
- Release `v1.0`.

## Beyond v1 (parking lot)

- **v1.1**: per-user notification preferences; partition `audit_logs`; metrics endpoint; PWA offline queue.
- **v1.2**: barcode/QR scanning; serialised asset tracking; multi-location.
- **v1.3**: SSO (OAuth + SAML); SCIM provisioning; SMS + Slack notifications.
- **v1.4**: purchase-order workflow; supplier catalogue.
- **v2.0**: multi-tenant SaaS posture (per-org schema or row-level isolation).

## Cadence

Two-week sprints, one phase per sprint after Phase 0 (which spans two). Each sprint ends with a tagged release and a smoke deploy to staging.
