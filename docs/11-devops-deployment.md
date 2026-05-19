# 11 — DevOps & Deployment Plan

## 1. Environments

| Env | Purpose | Data |
|---|---|---|
| `dev` (local) | Engineer laptop via `docker compose` | Seeded |
| `ci` | CI per-job ephemeral containers | Seeded |
| `staging` | Pre-prod; mirrors prod config; smoke tests after deploy | Sanitized snapshot of prod |
| `prod` | Live | Live |

## 2. Local stack

`docker-compose.yml` brings up:

```yaml
services:
  postgres:    # Postgres 16, named volume "pgdata"
  mailhog:     # SMTP catcher on 1025, UI on 8025
  app:         # Next.js dev server (bind-mounted source for hot reload)
```

Quickstart:
```bash
cp .env.example .env
docker compose up -d postgres mailhog
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

## 3. Production stack (single host)

Same `docker-compose.yml` with the `prod` profile:

```yaml
services:
  postgres:   { image: postgres:16, restart: always, volumes: [pgdata:/var/lib/postgresql/data] }
  app:        { build: ., restart: always, env_file: .env.prod, depends_on: [postgres] }
  caddy:      { image: caddy:2, ports: ["80:80","443:443"], volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data] }
```

- TLS terminated at Caddy with automatic ACME.
- App container runs `node server.js` (Next.js standalone output).
- Nightly `pg_dump` cron on host; backups encrypted with `age` and copied off-host.

## 4. Container image

`Dockerfile` is multi-stage:

1. `deps` — install pnpm deps with cache.
2. `builder` — `pnpm prisma generate` + `pnpm build` (Next.js `output: 'standalone'`).
3. `runner` — `node:22-alpine`, non-root user, only the `.next/standalone` + `.next/static` + `public/` copied in. Health-check hits `/healthz`.

## 5. CI/CD

GitHub Actions:

- `ci.yml` — lint, type, unit, integration, audit-coverage, openapi-coverage on every PR.
- `e2e.yml` — Playwright on `main` and on PRs with the `e2e` label.
- `release.yml` — on tag `v*`:
  1. Build & push image to GHCR.
  2. SSH into staging host, `docker compose pull && docker compose up -d`.
  3. Run `pnpm prisma migrate deploy` against staging.
  4. Run smoke E2E against staging.
  5. Manual approval gate → repeat on prod.

## 6. Configuration

All config via env. `src/env.ts` (zod) validates required envs at boot — the process exits with a clear error if anything is missing, so misconfiguration fails loudly at start, never silently at request time.

Required envs:

```
DATABASE_URL=postgresql://user:pw@postgres:5432/inventory
NEXTAUTH_SECRET=<openssl rand -hex 32>
NEXTAUTH_URL=https://inventory.example.com
SMTP_HOST=, SMTP_PORT=, SMTP_USER=, SMTP_PASS=, MAIL_FROM=
NODE_ENV=production
LOG_LEVEL=info
APP_BASE_URL=https://inventory.example.com
LOW_STOCK_SCAN_CRON=*/15 * * * *
NEAR_EXPIRY_SCAN_CRON=0 9 * * *
NEAR_EXPIRY_WINDOW_DAYS=30
RATE_LIMIT_AUTH_PER_MIN=5
RATE_LIMIT_API_PER_MIN=60
```

`NEXTAUTH_SECRET` and `SMTP_PASS` are secrets — sourced from the host's secret manager (or `.env.prod` mode 0600). Never committed.

## 7. Database lifecycle

- Schema changes ship as Prisma migrations; reviewed in PRs.
- `prisma migrate deploy` runs as a one-shot job at release time, before app containers are rolled.
- Backwards-compatible migrations only on prod (expand → backfill → contract pattern). Breaking column drops require a two-release cycle.
- Long-running migrations (index creation) use `CONCURRENTLY` where possible (Postgres 16).

## 8. Observability

- Logs: stdout JSON, scraped by host log shipper (Vector / Promtail → Loki in v1.1).
- Health: `GET /healthz` (liveness, always 200 if process alive), `GET /readyz` (returns 503 if Postgres ping fails or outbox lag > 5 min).
- Metrics (v1.1): `/metrics` endpoint exposing Prom counters: `http_requests_total`, `stock_adjustments_total`, `outbox_lag_seconds`, `auth_failures_total`.

## 9. Runbooks

`docs/runbooks/` (created later by ops team):

- `outbox-lag.md` — diagnose the dispatcher, manually requeue stuck rows.
- `db-restore.md` — verify nightly dump, point-in-time recovery.
- `lockout-storm.md` — reset `failed_login_count`, investigate brute force.
- `migration-rollback.md` — when expand/backfill/contract goes wrong.

## 10. Security operations

- Quarterly dependency audit via `pnpm audit` and Dependabot.
- Secrets rotated every 90 days (`NEXTAUTH_SECRET`, DB password, SMTP creds).
- Penetration test pre-launch and annually thereafter.
- Backups verified by restoring to a sandbox DB monthly.

## 11. Cost / capacity (estimate)

- Single 2 vCPU / 4 GB host runs the entire stack to 100 concurrent users comfortably.
- Postgres sized for 10× growth before vertical bump needed.
- When the app outgrows a single host: lift Postgres to managed (RDS/Cloud SQL), scale app horizontally behind Caddy/ALB, move outbox dispatcher to a dedicated worker container.
