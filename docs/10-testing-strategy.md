# 10 — Testing Strategy

## 1. Goals

- Prove behavioural correctness of business invariants (especially stock math and RBAC) — these are the parts that, if broken, lose physical inventory or leak data.
- Catch contract drift between client and API.
- Run fast enough that engineers don't skip them.

## 2. Test pyramid

```
        ▲   E2E (Playwright) — happy paths per role
       ┌─┐
      ┌───┐  Integration — API routes against a real Postgres
     ┌─────┐
    ┌───────┐ Unit — services, DTO parsing, RBAC helpers, audit sanitizer
   └─────────┘
```

Approximate ratios at v1: 70% unit, 25% integration, 5% e2e.

## 3. Tools

| Layer | Tool | Why |
|---|---|---|
| Unit / integration | **Vitest** | Native TS, fast watch, ESM-friendly |
| HTTP mocking (rare) | **msw** | Only for outbound HTTP in tests |
| DB | **Testcontainers Postgres** (CI) / local `docker compose` (dev) | Real Postgres beats SQLite for our enum/jsonb usage |
| Component | **Vitest + Testing Library + jsdom** | Co-located with components |
| E2E | **Playwright** | Cross-browser; trace viewer is gold |
| Contract | zod-derived OpenAPI compared against route handlers via reflection test |
| Lint / type | `tsc --noEmit`, `eslint`, `prettier --check` | Pre-commit + CI |

## 4. Folder layout

```
tests/
├── unit/
│   ├── stock-service.spec.ts
│   ├── rbac.spec.ts
│   ├── audit-sanitize.spec.ts
│   └── dto-parse.spec.ts
├── integration/
│   ├── items-api.spec.ts
│   ├── requests-api.spec.ts
│   ├── rbac-matrix.spec.ts
│   └── openapi-coverage.spec.ts
├── component/
│   └── stock-adjuster.spec.tsx
├── e2e/
│   ├── admin-happy-path.spec.ts
│   ├── editor-happy-path.spec.ts
│   └── fixtures/
└── helpers/
    ├── db.ts          ← Testcontainers boot + prisma migrate
    ├── factories.ts   ← user, item, request factories
    └── http.ts        ← in-process API caller using Next route handlers
```

## 5. Unit testing

- Services are pure-ish: they take dependencies (`repo`, `events`) via constructor injection in tests, so we mock the repo and assert calls + return values.
- Pure helpers (RBAC, audit sanitiser, stock-state derivation) are tested with table-driven cases.

Example invariants we *must* test in `stock-service.spec.ts`:

- `adjust({ delta: 0 })` → `VALIDATION_FAILED`
- `adjust` that would push `currentStock < 0` → `STOCK_BELOW_ZERO`
- `adjust` writes exactly one `stock_adjustments` row with correct `balance_after`
- `adjust` to `currentStock < reorder_threshold` emits `item.lowStock`
- Concurrent adjustments don't lose updates (uses `SELECT … FOR UPDATE`)

## 6. Integration testing

- A `tests/helpers/db.ts` boots a Postgres testcontainer once per suite, runs Prisma migrations, exposes `withTx(fn)` that wraps tests in a transaction rolled back at teardown for speed.
- API tests call route handlers directly (not over the network) using a helper that mimics `Request`/`Response` and bypasses Next routing — see `tests/helpers/http.ts`. This keeps tests fast and avoids port management.
- The **RBAC matrix test** is generated from `docs/06-rbac-matrix.md`'s machine-readable counterpart `src/server/auth/policy.ts` and iterates every endpoint × role.

## 7. Component testing

- Render in jsdom; assert behaviour, not snapshots.
- For `StockAdjuster`: render with `currentStock=3`, click `+`, fill reason, submit → expect `onSubmit` called with `{ delta: 1, reason: 'RECEIVED' }`.

## 8. E2E testing

Three smoke flows, one per role:

- **Admin**: login → create category → create item → submit request as editor (separate context) → approve → fulfil → assert stock decremented and audit log entry visible.
- **Editor**: login → adjust stock → submit request → see notification → can't access /users.
- **Viewer**: login → can read inventory & audit, cannot mutate.

Playwright traces are uploaded as CI artifacts on failure.

## 9. Performance smoke (deferred)

A k6 script in `perf/items-list.js` runs against a seeded 50k-item DB and asserts p95 < 300 ms for `GET /items`. Runs nightly on a perf branch.

## 10. CI matrix

GitHub Actions:

1. **lint** — `eslint`, `prettier --check`.
2. **type** — `tsc --noEmit`.
3. **unit** — `vitest run --project unit`.
4. **integration** — `vitest run --project integration` with testcontainers.
5. **e2e** — Playwright against `docker compose up` stack.
6. **audit-coverage** — fails if any new action verb appears without test coverage.
7. **openapi-coverage** — fails if any route lacks a documented schema.

PRs blocked on 1-4 + 6-7. E2E runs on `main` and on `e2e` label.

## 11. What we deliberately don't test (v1)

- Pixel-perfect visual regression — Storybook + Chromatic is overkill at this size.
- Cross-browser CSS rendering — Playwright runs in Chromium only at v1.
- Load testing — k6 is wired but not gated.

## 12. Definition of done (test perspective)

A PR is mergeable only when:
- New public service methods have unit tests for happy + at least one error path.
- New API routes have integration tests for the happy path and the dominant RBAC rejection.
- New audit verbs and event topics are referenced in `audit-coverage.spec.ts` and `notifications-coverage.spec.ts`.
