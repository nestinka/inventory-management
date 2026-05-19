# Runbook 02 — Incident Response

## Severity levels

| Level | Description | Examples | Response time |
|---|---|---|---|
| **P1** | Data loss, auth completely broken, or all users blocked from the system | App crashes on every request; all logins fail; DB unreachable | Immediate — page on-call |
| **P2** | A feature is broken for a subset of users or a specific workflow is unavailable | Stock adjustments failing for editors; email not sending; one report returning 500 | Same business day |
| **P3** | Cosmetic or non-blocking issue | Wrong label text; minor layout glitch; slow query on a rarely-used page | Next sprint |

---

## P1 triage steps

1. **Check application logs**
   ```bash
   docker compose logs app --tail=200 --follow
   ```
   Look for repeated `ERROR` or `FATAL` entries. The JSON log includes `err.message`, `err.stack`, and the request path.

2. **Check database connectivity**
   ```bash
   docker compose exec postgres pg_isready -U inventory
   ```
   If this fails, the Postgres container may have crashed or the volume may be full.
   ```bash
   df -h   # check disk space on the host
   docker compose ps
   ```

3. **Check environment variables**
   ```bash
   docker compose exec app env | grep -E 'DATABASE_URL|NEXTAUTH|SMTP|APP_BASE'
   ```
   Missing required vars cause a boot-time exit with a clear error from `src/env.ts`. Look for:
   ```
   Invalid environment variables: DATABASE_URL: Required
   ```

4. **Check readiness endpoint**
   ```bash
   curl -v https://inventory.example.com/readyz
   ```
   A 503 with body `{"postgres":"error"}` means the DB is unreachable. A 503 with `{"outboxLag":"high"}` means the outbox dispatcher has stalled.

---

## Common incidents and resolutions

### App won't start — missing environment variable

**Symptom:** Container exits immediately; logs show `Invalid environment variables`.

**Resolution:**
1. Identify the missing variable from the error message.
2. Add it to `.env.prod`.
3. Restart the container:
   ```bash
   docker compose --profile prod up -d --no-deps app
   ```
4. Verify `/healthz` returns 200.

The full list of required env vars is validated by `src/env.ts` and documented in runbook 01.

---

### Auth fails for all users — NEXTAUTH_SECRET mismatch or expired JWT

**Symptom:** All users see "Session expired" or are redirected to login in a loop; `POST /api/auth/session` returns 401/500.

**Cause:** `NEXTAUTH_SECRET` was changed without invalidating existing JWTs, or the secret differs between replicas.

**Resolution:**
1. Confirm the secret is consistent:
   ```bash
   docker compose exec app env | grep NEXTAUTH_SECRET
   ```
2. Rotate the secret to a new known value:
   ```bash
   openssl rand -hex 32
   # Update .env.prod
   docker compose --profile prod up -d --no-deps app
   ```
3. All existing sessions will be invalidated. Users must log in again. Notify users if the impact is widespread.

---

### Stock adjustments fail with FK violation

**Symptom:** Editors receive a 500 error when submitting a stock adjustment. Logs show a Postgres foreign-key violation on `stock_adjustments.adjusted_by` referencing `users.id`.

**Cause:** A stale session contains a user UUID that no longer matches the database (common after a full re-seed that assigned new UUIDs to seed users).

**Immediate fix (per affected user):**
1. Ask the user to log out and log back in to obtain a fresh session token.

**Root cause prevention (long-term):**
- Ensure the seed script uses deterministic, stable UUIDs for seed users so that re-seeding never changes their `id` values. Review `prisma/seed.ts`.

---

### Email not sending

**Symptom:** Users report they are not receiving notification emails. Outbox rows remain in `status = 'pending'` or `status = 'failed'`.

**Dev environment:**
1. Confirm Mailhog is running:
   ```bash
   docker compose ps mailhog
   ```
2. Open Mailhog UI at `http://localhost:8025` to see captured emails.
3. Check `SMTP_HOST=localhost` and `SMTP_PORT=1025` in `.env`.

**Production:**
1. Check SMTP credentials and connectivity:
   ```bash
   docker compose exec app env | grep SMTP
   ```
2. Test SMTP connectivity from the container:
   ```bash
   docker compose exec app nc -zv $SMTP_HOST $SMTP_PORT
   ```
3. Check outbox dispatcher logs for error details:
   ```bash
   docker compose logs app | grep -i "outbox\|dispatcher\|mail"
   ```
4. If the dispatcher has stalled, restart the app container:
   ```bash
   docker compose --profile prod restart app
   ```
5. Failed outbox rows are retried up to 10 times with exponential back-off. After 10 failures, rows are marked `dead` and will not be retried automatically — manual intervention or a support ticket to the SMTP provider may be required.

---

### High memory usage or slow responses

**Symptom:** App response times exceed 2 s; container memory is near the limit; Postgres CPU is high.

**Immediate mitigation:**
1. Disable background cron jobs to reduce load:
   ```bash
   # Update .env.prod: DISABLE_BACKGROUND_JOBS=true
   docker compose --profile prod up -d --no-deps app
   ```
2. Check for runaway queries in Postgres:
   ```sql
   SELECT pid, query_start, state, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY query_start;
   ```
3. Check low-stock and near-expiry scanner logs:
   ```bash
   docker compose logs app | grep -E "scanner|cron|lowStock|nearExpiry"
   ```

**Resolution:**
- Review scanner query EXPLAIN plans (saved in `docs/`) for regressions.
- Add missing indexes if a table has grown significantly.
- Re-enable background jobs after the slow query is resolved.

---

## Escalation matrix

| Severity | First responder | Escalate to | SLA |
|---|---|---|---|
| P1 | On-call engineer | Engineering lead + project owner | Acknowledge within 15 min; resolve or mitigate within 2 h |
| P2 | On-call engineer | Engineering lead | Acknowledge within 4 h; resolve within 1 business day |
| P3 | Engineering team | — | Schedule in next sprint |

Post-incident: write a brief blameless post-mortem for all P1 and recurring P2 incidents. Add any new failure mode discovered here as a new scenario entry in this runbook.
