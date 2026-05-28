# 02 — System Architecture

## 1. Architectural style

**Modular monolith, API-first, clean-architecture-lite.**

Single Next.js 16 deployable; internally divided into bounded modules that communicate only through their public services. A future extraction to microservices is possible by lifting any one `src/server/modules/*` directory behind an HTTP boundary without rewriting consumers.

```
┌────────────────────────────────────────────────────────────────┐
│                     Browser / PWA                              │
│   Next.js App Router pages • React 19 • Tailwind • shadcn/ui    │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS / JSON
┌──────────────────────────────▼─────────────────────────────────┐
│                Next.js Route Handlers (API layer)              │
│   • zod-validated DTOs   • NextAuth session   • RBAC guards    │
│   • Rate limit           • Structured logging  • Error mapper  │
└──────────────────────────────┬─────────────────────────────────┘
                               │ in-process calls
┌──────────────────────────────▼─────────────────────────────────┐
│            Domain Services  (src/server/modules/*)             │
│  categories │ items │ stock │ requests │ audit │ notifications │
│             public service per module; no cross-imports        │
└────────────┬────────────────────────┬──────────────────────────┘
             │                        │
             │                        │  emits domain events
             ▼                        ▼
   ┌─────────────────┐      ┌────────────────────────┐
   │  Prisma client  │      │   In-process EventBus  │
   │   (Postgres)    │      │   ↳ AuditSubscriber    │
   └─────────────────┘      │   ↳ NotificationSub    │
                            └────────────┬───────────┘
                                         │
                                         ▼
                                ┌────────────────┐
                                │  Mail provider │
                                │ (SMTP / Mailhog)│
                                └────────────────┘
```

Workers / cron jobs (low-stock scan, near-expiry scan, digest emails) run inside the same Node process via `node-cron` for v1; lifted to a separate worker container only when load demands it.

## 2. Layered structure (clean architecture)

```
src/
├── app/                       ← Next.js App Router (presentation: pages + routes)
├── components/                ← React UI components (presentation)
├── server/
│   ├── modules/<name>/
│   │   ├── service.ts         ← Required. Business logic; DB calls inline by default.
│   │   ├── dto.ts             ← Required. Zod schemas / inferred types for I/O.
│   │   ├── index.ts           ← Required. Public barrel — the ONLY allowed import surface.
│   │   ├── domain.ts          ← Optional. Pure types / value objects beyond the Prisma types.
│   │   └── repo.ts            ← Optional. Lifted from service.ts when DB queries grow large.
│   ├── auth/                  ← NextAuth options, session helpers, RBAC
│   ├── events/                ← Bus, subscriber registry
│   ├── jobs/                  ← node-cron scanners (low-stock, near-expiry)
│   ├── lib/                   ← Cross-cutting: logger, errors, rate-limit, mail, audit, route helper
│   └── db/                    ← Prisma client singleton
├── lib/                       ← Client-safe helpers (no `server-only` imports)
└── env.ts                     ← Zod-validated environment
```

`categories`, `items`, and `users` use the full five-file layout (their domain types extend the Prisma types and the queries are large enough to extract). The other six modules (`audit`, `auth`, `notifications`, `reports`, `requests`, `stock`) keep DB calls inline in `service.ts` and rely on the Prisma-generated types directly. Either form is canonical; the barrel-import rule below applies to both.

### Hard rules
- `app/api/**` may import only from `server/modules/<name>` (the barrel) and `server/lib`.
- Modules **may not import each other's internals** (`<name>/repo.ts`, etc.). Cross-module work happens through events or by re-exposing a service method on the public barrel.
- `lib/` is browser-safe; anything Node-only lives under `server/`.

## 3. Request lifecycle (state-changing example)

1. Client `POST /api/items` with JSON body.
2. Route handler parses session via `getServerAuthSession()`; rejects with 401 if absent.
3. RBAC guard checks role against the route's policy (`requireRole('ADMIN')`).
4. Body parsed via `CreateItemDto.parse(body)` — invalid → 422.
5. `itemsService.create(input, actor)` called.
6. Service runs business invariants (threshold ≥ 0, stock ≥ 0).
7. Service writes through `itemsRepo` (Prisma transaction).
8. Service emits `item.created` event on the bus.
9. `AuditSubscriber` writes an `AuditLog` row (same transaction via outbox table, see §5).
10. Response returned; structured log line emitted with `requestId`, `userId`, `action`, `durationMs`.

## 4. Authentication & authorization

- **NextAuth.js v5 (Auth.js)** with the Credentials provider.
- Passwords hashed with `bcrypt` (cost = 12).
- JWT session strategy; session cookie is httpOnly, Secure, SameSite=Lax.
- Roles persisted on `User.role`, stamped into the JWT at sign-in.
- RBAC enforced at three layers:
  1. **Route guard** — fast-fail in route handlers.
  2. **Service guard** — defence-in-depth, prevents internal callers from skipping.
  3. **UI guard** — conditional rendering for menu items / buttons (UX only, never sole gate).

See [06 — RBAC matrix](./06-rbac-matrix.md).

## 5. Data integrity & the outbox pattern

To guarantee that an audit log entry exists for every committed business write, we use a transactional outbox:

```
BEGIN
  write business rows
  insert into AuditLog (same tx)
  insert into EventOutbox (same tx)  ← serialized event payload
COMMIT
```

A lightweight in-process dispatcher (poll-based, 1s interval) reads `EventOutbox`, hands each event to subscribers (notifications), and marks the row `dispatched`. This avoids the dual-write problem and means we can replace the dispatcher with Kafka/SQS later without touching producers.

## 6. Observability

- **Logging**: `pino` JSON logs with a request-id middleware. Each log line includes `userId`, `module`, `action`, `requestId`. Sensitive fields (`password`, `token`) are redacted by `pino` serializers.
- **Metrics** (deferred to v1.1): `prom-client` exposing `/metrics`.
- **Tracing** (deferred): OpenTelemetry hooks in event bus and Prisma middleware.

## 7. Security controls

| Threat | Mitigation |
|---|---|
| Credential stuffing | Rate-limit `/api/auth/*` to 5 req/min/IP; account lockout after 10 failures |
| CSRF | NextAuth's CSRF token on credential POST; SameSite=Lax cookies; state-changing API routes require same-origin |
| XSS | React auto-escapes; no `dangerouslySetInnerHTML`; CSP header `default-src 'self'` |
| SQL injection | Prisma parameterized queries throughout; no raw SQL outside `prisma.$queryRaw` calls (none used v1) |
| Mass-assignment | zod DTOs whitelist allowed fields; never spread request bodies into Prisma calls |
| Privilege escalation | Role is read from server-side session, never from request body |
| Brute audit-log tampering | Audit writes are append-only at the application layer; DB user lacks `DELETE` on `AuditLog` |
| Sensitive data at rest | Passwords bcrypt; PII columns can be encrypted in v1.1 via pgcrypto if required |

## 8. Caching

- Catalogue read endpoints use Next.js `cache: 'no-store'` for v1 to keep correctness simple.
- Stock numbers are **never** cached at the HTTP edge — always read live from Postgres.
- Cross-cutting reference data (departments, units of measure) cached in-memory for 60s via a tiny `lru-cache` wrapper.

## 9. Deployment topology (v1)

```
docker-compose:
  app          → Next.js (Node 22), 1 replica
  postgres     → Postgres 16, named volume
  mailhog      → dev SMTP catcher; replaced by real SMTP in prod env
```

See [11 — DevOps & Deployment](./11-devops-deployment.md).
