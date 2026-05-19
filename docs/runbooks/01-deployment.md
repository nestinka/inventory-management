# Runbook 01 — Deployment

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Docker | 24+ | Docker Compose v2 bundled |
| pnpm | 9+ | `npm i -g pnpm` |
| Node.js | 20 LTS | Used for local tooling; container uses Node 22 |
| PostgreSQL | 16 (via Docker) | Managed by Compose in local/prod |

---

## Local development setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd inventory-management

# 2. Create environment file
cp .env.example .env
# Edit .env if needed — defaults work out of the box with the Compose stack

# 3. Start backing services (Postgres + Mailhog)
docker compose up -d postgres mailhog

# 4. Install dependencies
pnpm install

# 5. Run database migrations
pnpm db:migrate          # runs: prisma migrate dev

# 6. Seed the database
pnpm db:seed             # idempotent — safe to re-run

# 7. Start the dev server
pnpm dev                 # listens on http://localhost:7000
```

Mailhog UI is available at `http://localhost:8025` to inspect outgoing emails.

Seed credentials:

| Email | Password | Role |
|---|---|---|
| admin@inventory.local | Admin1234! | ADMIN |
| editor@inventory.local | Editor1234! | EDITOR |
| viewer@inventory.local | Viewer1234! | VIEWER |

---

## Production deployment

### Build and push image

```bash
# Build the multi-stage Docker image
docker build -t ghcr.io/<org>/inventory-management:<tag> .

# Push to registry
docker push ghcr.io/<org>/inventory-management:<tag>
```

The multi-stage Dockerfile produces a minimal `node:22-alpine` runner image using Next.js standalone output.

### Configure environment variables

Copy `.env.example` to `.env.prod` on the production host and fill in all required values (see table below). Set file permissions to `0600`.

```bash
chmod 0600 .env.prod
```

### Run database migrations (before rolling the container)

```bash
# On the production host — runs against the live DATABASE_URL
docker run --rm \
  --env-file .env.prod \
  ghcr.io/<org>/inventory-management:<tag> \
  npx prisma migrate deploy
```

Never use `prisma migrate dev` in production — it can prompt interactively and resets shadow databases.

### Start / update the app container

```bash
# Pull the new image
docker compose --profile prod pull app

# Restart the app container (zero-downtime if behind Caddy)
docker compose --profile prod up -d --no-deps app
```

Caddy handles TLS termination automatically via ACME. No certificate management is required.

### Health checks

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Liveness — returns 200 if the process is alive |
| `GET /readyz` | Readiness — returns 503 if Postgres ping fails or outbox lag > 5 min |

Wait for `GET /readyz` to return 200 before directing traffic to the new container.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string: `postgresql://user:pw@host:5432/inventory` |
| `NEXTAUTH_SECRET` | Yes | Random 32-byte hex string. Generate: `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Yes | Full URL of the app: `https://inventory.example.com` |
| `APP_BASE_URL` | Yes | Same as `NEXTAUTH_URL` — used for email links |
| `NODE_ENV` | Yes | Set to `production` in prod |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port (typically 587 or 465) |
| `SMTP_SECURE` | No | `true` for port 465; `false` for STARTTLS (default: false) |
| `SMTP_USER` | Yes | SMTP username / address |
| `SMTP_PASS` | Yes | SMTP password (keep secret) |
| `MAIL_FROM` | Yes | Sender address: `"Inventory <no-reply@example.com>"` |
| `LOG_LEVEL` | No | `error` / `warn` / `info` / `debug` (default: `info`) |
| `LOW_STOCK_SCAN_CRON` | No | Cron for low-stock scanner (default: `*/15 * * * *`) |
| `NEAR_EXPIRY_SCAN_CRON` | No | Cron for near-expiry scanner (default: `0 9 * * *`) |
| `NEAR_EXPIRY_WINDOW_DAYS` | No | Days ahead to flag near-expiry items (default: `30`) |
| `RATE_LIMIT_AUTH_PER_MIN` | No | Max auth attempts per IP per minute (default: `5`) |
| `RATE_LIMIT_API_PER_MIN` | No | Max API requests per user per minute (default: `60`) |
| `DISABLE_BACKGROUND_JOBS` | No | Set `true` to disable cron scanners (useful in CI/debug) |

Missing required variables cause the app to exit at boot with a precise error message (enforced by `src/env.ts`).

---

## Rollback procedure

**Never roll back database migrations.** Migrations are forward-only. Use the expand-backfill-contract pattern for breaking changes.

To roll back the application code:

```bash
# Re-deploy the previous image tag
docker compose --profile prod up -d --no-deps app \
  --build-arg IMAGE_TAG=<previous-tag>
```

Or update the image reference in `docker-compose.yml` to the previous tag and run:

```bash
docker compose --profile prod up -d --no-deps app
```

Confirm health:

```bash
curl -f https://inventory.example.com/readyz
```

---

## Rotating secrets

`NEXTAUTH_SECRET` and `SMTP_PASS` must be rotated every 90 days (see `docs/11-devops-deployment.md` §10).

When `NEXTAUTH_SECRET` is rotated, all active sessions are invalidated — users will be prompted to log in again. Schedule this during a low-traffic window.

```bash
# Generate a new secret
openssl rand -hex 32

# Update .env.prod, then restart the app
docker compose --profile prod up -d --no-deps app
```
