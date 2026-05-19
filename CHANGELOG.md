# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
