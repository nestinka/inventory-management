# Runbook 03 — Database Maintenance

## Running migrations

### Development

```bash
pnpm db:migrate
# Equivalent to: npx prisma migrate dev
```

This command:
- Detects schema changes in `prisma/schema.prisma`.
- Generates a new timestamped migration file under `prisma/migrations/`.
- Applies the migration to the local database.
- Regenerates the Prisma client.

### Production

```bash
# Run as a one-shot job before rolling the app container
npx prisma migrate deploy
```

**Never run `prisma migrate dev` in production.** It is designed for development only and can prompt interactively, create a shadow database, and behave unexpectedly against a live DB.

The CI/CD release pipeline (`release.yml`) runs `migrate deploy` automatically as a pre-deployment step. If running manually (e.g., hotfix), run it from a container with access to the production `DATABASE_URL` before restarting the app container.

### Migration safety rules

- All production migrations must be backwards-compatible (expand-backfill-contract pattern).
- Breaking column drops require a two-release cycle: first release removes the application-side reference; second release drops the column.
- Long-running operations (e.g., index creation on large tables) should use `CONCURRENTLY` where Postgres supports it to avoid table locks.

---

## Re-seeding

The seed script is idempotent and safe to re-run in development:

```bash
pnpm db:seed
# Equivalent to: npx prisma db seed
```

The seed upserts the three default users using stable, deterministic UUIDs so that re-seeding never changes existing user IDs. This prevents foreign-key violations in sessions or audit logs that reference seed users.

Do not run the seed script against a production database. Production data is not seeded.

---

## Backup strategy

### Automated nightly backup (production)

A cron job runs on the host at 02:00 UTC:

```bash
# /etc/cron.d/inventory-backup
0 2 * * * root /opt/inventory/scripts/backup.sh
```

`backup.sh` (example):
```bash
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/backups/inventory_${DATE}.dump"

docker compose exec -T postgres pg_dump \
  -U inventory -Fc inventory > "$DUMP_FILE"

# Encrypt with age (https://age-encryption.org)
age -r <recipient-public-key> -o "${DUMP_FILE}.age" "$DUMP_FILE"
rm "$DUMP_FILE"

# Copy encrypted dump to off-host storage (e.g., S3 / rclone)
rclone copy "${DUMP_FILE}.age" remote:inventory-backups/
```

Backups must be verified monthly by restoring to a sandbox database (see §Restore procedure below).

Retention policy:
- Daily backups retained for 30 days.
- Weekly backups (every Sunday) retained for 3 months.
- Monthly backups retained for 1 year.

---

## Restore procedure

```bash
# 1. Decrypt the backup
age -d -i <identity-file> inventory_20260519_020000.dump.age \
  -o inventory_restore.dump

# 2. Create a target database (DO NOT restore over the live DB without a maintenance window)
createdb -U inventory inventory_restore

# 3. Restore
pg_restore -U inventory -d inventory_restore \
  --no-owner --role=inventory inventory_restore.dump

# 4. Verify key table row counts
psql -U inventory -d inventory_restore \
  -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# 5. Promote to production (in a maintenance window)
# Stop the app, swap DATABASE_URL to point to the restored DB, run migrate deploy, restart app.
```

Test restores in a sandbox environment monthly to ensure backup integrity.

---

## Table growth and append-only tables

The following tables are **append-only** by architecture contract. Do not `UPDATE` or `DELETE` rows from them:

| Table | Description |
|---|---|
| `audit_logs` | Immutable audit trail of all business actions |
| `stock_adjustments` | Full history of every stock change |
| `request_status_events` | Status transition history for every request |
| `event_outbox` | Transactional event queue (rows are marked dispatched, not deleted) |

These tables grow without bound and should not be purged. Instead, use the **archiving strategy** below.

### Archiving strategy (when tables exceed manageable size)

For rows older than 2 years:

```sql
-- Create archive schema if it does not exist
CREATE SCHEMA IF NOT EXISTS archive;

-- Example: archive old audit_logs
CREATE TABLE IF NOT EXISTS archive.audit_logs (LIKE public.audit_logs INCLUDING ALL);

INSERT INTO archive.audit_logs
SELECT * FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '2 years';

-- Verify counts match before deleting from public
DELETE FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '2 years';
```

Run archiving during a low-traffic window. Use batched deletes to avoid long-held locks:

```sql
-- Batched delete example (1000 rows at a time)
DO $$
DECLARE
  deleted INT;
BEGIN
  LOOP
    DELETE FROM public.audit_logs
    WHERE id IN (
      SELECT id FROM public.audit_logs
      WHERE created_at < NOW() - INTERVAL '2 years'
      LIMIT 1000
    );
    GET DIAGNOSTICS deleted = ROW_COUNT;
    EXIT WHEN deleted = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

---

## Idempotency keys cleanup

The `idempotency_keys` table stores request deduplication keys for 24 hours. Expired rows can be safely deleted.

Add a periodic cleanup job (run via cron or as part of a maintenance script):

```sql
DELETE FROM idempotency_keys
WHERE expires_at < NOW();
```

Recommended frequency: once daily, during the backup window.

---

## Password reset tokens cleanup

The `password_reset_tokens` table stores signed tokens that expire after a fixed window. Expired and used tokens can be safely deleted:

```sql
DELETE FROM password_reset_tokens
WHERE expires_at < NOW()
   OR used_at IS NOT NULL;
```

Recommended frequency: once daily.

---

## Useful maintenance queries

```sql
-- Check table sizes
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Check for bloat (high dead_tup ratio)
SELECT relname, n_dead_tup, n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_pct DESC;

-- Manual VACUUM on a bloated table
VACUUM ANALYZE audit_logs;

-- Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```
