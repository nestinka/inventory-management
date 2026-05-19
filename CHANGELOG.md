# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] — 2026-05-20

### Added
- Audit log table: **Description** column shows a human-readable label ("Request approved") alongside the target entity type and short ID; replaces the raw Target column
- Audit log CSV export now includes a Description column with the same human-readable label and full target entity reference
- VIEWER role can submit new requests, view their own requests, and cancel their own pending requests
- EDITOR role can create items, browse the items catalogue, and adjust stock from the catalogue page

### Changed
- Audit log and Reports pages/APIs are now restricted to **ADMIN and EDITOR** only (VIEWER no longer has access)
- Items catalogue nav link is now visible to EDITOR in addition to ADMIN
- EDITOR action buttons on the items list (Edit, Delete) are hidden for EDITOR — only Adjust Stock and New Item are available
- Audit log API role changed from `['ADMIN', 'VIEWER']` to `['ADMIN', 'EDITOR']`

---

## [1.0.0] — 2026-05-19

### Added
- Complete inventory catalogue (items, categories) with CRUD and soft-delete
- Stock adjustment system with full audit trail and event outbox
- Request & approval workflow (PENDING → APPROVED → FULFILLED)
- Role-based access control: ADMIN, EDITOR, VIEWER
- In-app notification inbox and email notifications via SMTP
- Dashboard with real-time inventory health cards
- Audit log explorer with CSV export
- Reports: consumption, low-stock, near-expiry, request analytics
- Quick Stock Update screen (mobile-optimised)
- Account lockout after 10 failed login attempts (15-minute window)
- Password reset via signed email token
- Rate limiting: 5/min on auth, 60/min on API per user
- Accessibility: WCAG 2.1 AA compliance verified with axe-core
- Docker Compose stack (Postgres, Mailhog, app)
- GitHub Actions CI pipeline (lint, typecheck, unit, integration, e2e)
