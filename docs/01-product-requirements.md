# 01 — Product Requirements Breakdown

## 1. Vision

A single, audit-compliant system of record for an IT company's physical inventory — laptops, peripherals, networking gear, consumables, spares — that replaces ad-hoc spreadsheets and email approval chains.

Optimised for two operating modes:

1. **Desk-bound admin work** — bulk edits, reporting, audits.
2. **Floor / store-room work on a phone** — quick stock adjustments while standing at a shelf.

## 2. Personas

| Persona | Primary job-to-be-done | Devices |
|---------|------------------------|---------|
| **Admin** (IT Manager, Store-room owner) | Maintain catalogue, approve requests, run audits, configure thresholds | Desktop + mobile |
| **Editor** (Helpdesk / Tech) | Request items, adjust stock as items are issued/returned, log damage/expiry | Mobile-first |
| **Viewer** (Department head, Finance) | View stock levels, request analytics, audit reports | Desktop |
| **System** | Emit notifications, run scheduled jobs (low-stock scan, near-expiry scan) | — |

## 3. Functional scope (in)

### 3.1 Catalogue
- CRUD for **Categories** (tree depth = 1 for v1; nesting deferred).
- CRUD for **Items** with attributes: name, description, unit of measure (UoM), current stock, reorder threshold, expiry date (nullable, consumables only), status (`ACTIVE | INACTIVE | DISCONTINUED`), category.
- Soft delete (no hard delete from UI).

### 3.2 Inventory tracking
- Real-time stock visibility per item with three-tier visual indicator:
  - **Green** — stock ≥ reorder threshold
  - **Yellow** — `0 < stock < reorder threshold`
  - **Red** — stock = 0
- Expiry tracking for items with `expiryDate != null`.
- Near-expiry rule: configurable window (default 30 days).
- Per-item **stock history timeline**: every adjustment with delta, reason, actor, timestamp.

### 3.3 Stock entries & adjustments
- Manual stock additions (receiving goods).
- Inline `+ / -` adjustment on the item row (desktop and mobile).
- Quick-update screen optimised for phones (large targets, one-hand reach).
- Every adjustment requires a `reason` enum: `DAMAGE | EXPIRY | AUDIT_CORRECTION | CONSUMPTION | MANUAL_OVERRIDE | RECEIVED | FULFILMENT`.
- Optional free-text note.

### 3.4 Requests & approvals
- Editors submit requests: one or more line items with `requestedQty`.
- Admins approve / reject. On approve, they set `approvedQty` (≤ requested).
- Admin (or Editor with admin's permission) marks fulfilment: `fulfilledQty` (≤ approved) — stock decrements at fulfilment time, not approval.
- Status machine: `PENDING → APPROVED | REJECTED`; `APPROVED → FULFILLED | CANCELLED`.
- Full timestamp history per status transition.

### 3.5 Audit log
- Append-only log of: item changes (incl. soft-delete), stock changes, request status changes, login/logout, role changes, category changes.
- Filterable by user, item, action type, date range.
- Retains diff (`before` / `after`) as JSON for entity changes.

### 3.6 Reporting
Dashboards and CSV/JSON exports:
- Current inventory snapshot.
- Low-stock list, out-of-stock list.
- Expiry calendar (next 90 days).
- Consumption trends (line chart, configurable window).
- Department-wise usage (joined via requester's department).
- Request analytics (approval rate, time-to-approve, time-to-fulfil).
- Audit report (action-type breakdown).

### 3.7 Notifications
Event-driven email notifications:
- Low-stock alert (debounced per item per 24h).
- Near-expiry alert (daily digest).
- Request status change (per request).
- Fulfilment completed (per request, to requester).
- New user invited / password reset.

Extension points: SMS, Slack, MS Teams (deferred; bus interface is provider-agnostic).

## 4. Functional scope (out, v1)

- Multi-warehouse / multi-location inventory (single location v1).
- Barcode / QR generation & scanning (planned v2).
- Purchase-order workflow (request workflow covers internal allocation only).
- Asset-tag tracking for serialised items (planned v2).
- Per-tenant multi-tenancy (single-tenant deploy v1).
- Mobile native apps (PWA-only).

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | p95 catalogue list < 300 ms server-side at 50k items |
| Availability | 99.5% (single-region, Postgres backup nightly) |
| Security | OWASP top-10 covered; bcrypt cost ≥ 12; CSRF on state-changing routes; rate-limit auth endpoints |
| Auditability | Every state-changing action produces an `AuditLog` row; logs are append-only at the application layer |
| Accessibility | WCAG 2.1 AA on all user-facing pages |
| i18n | English only v1; copy isolated for future extraction |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari (incl. iOS) |
| Mobile | Responsive down to 360 px; PWA-installable |

## 6. Success metrics

- ≤ 2 minutes from "I picked up an item off the shelf" to logged adjustment on phone.
- 100% of stock changes have an attributable user and reason.
- 0 spreadsheet sync incidents per quarter (baseline).
- Auditor can produce a 12-month change log for any item in < 30 seconds.

## 7. Assumptions

- Active Directory / SSO integration is desirable but not mandatory for v1 — credentials auth ships first, OAuth added later.
- Departments are a flat list, seeded by admin.
- Currency / pricing is **not** in scope (cost tracking is finance's job, not stockroom's).

## 8. Open questions (tracked for resolution before v1.1)

1. Should `FULFILMENT` and stock decrement be reversible (return-to-stock)?
2. Do we need per-category approval workflows (e.g. cabling auto-approved < 5 units)?
3. Reorder threshold per item only, or also a global "low-stock %" floor?
