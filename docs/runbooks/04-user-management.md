# Runbook 04 — User Management

> **Note:** There is no admin UI for user management in v1.0. All user management operations require direct database access via Prisma Studio or SQL. A web-based admin UI for user CRUD is planned for Phase 7.

---

## Creating a new user

### Option A — Prisma Studio (recommended for one-off creates)

```bash
npx prisma studio
# Opens at http://localhost:5555
# Navigate to the "User" table → "Add record"
```

Required fields:

| Field | Notes |
|---|---|
| `id` | UUID — generate with `gen_random_uuid()` or `crypto.randomUUID()` |
| `email` | Unique, lowercase |
| `password_hash` | bcrypt hash at 12 rounds — see §Password hashing below |
| `name` | Display name |
| `role` | One of `ADMIN`, `EDITOR`, `VIEWER` |
| `is_active` | `true` |
| `created_at` | Set to `NOW()` |

### Option B — Direct SQL

```sql
INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'newuser@example.com',
  '$2b$12$...bcrypt-hash...',  -- see §Password hashing
  'New User',
  'EDITOR',                    -- or ADMIN, VIEWER
  true,
  NOW(),
  NOW()
);
```

### Password hashing

Generate a bcrypt hash at cost 12 using Node.js:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('TemporaryPass1!', 12).then(h => console.log(h));"
```

Or with the `htpasswd` utility:

```bash
htpasswd -bnBC 12 "" 'TemporaryPass1!' | tr -d ':\n'
```

Inform the user of their temporary password via a secure channel and instruct them to reset it immediately via the `/forgot-password` flow.

---

## Unlocking a locked account

Users are locked out after 10 consecutive failed login attempts. The lockout window is 15 minutes, after which it clears automatically. To unlock immediately:

```sql
UPDATE users
SET locked_until = NULL,
    failed_login_count = 0,
    updated_at = NOW()
WHERE email = 'user@example.com';
```

Verify:

```sql
SELECT email, locked_until, failed_login_count, is_active
FROM users
WHERE email = 'user@example.com';
```

If there are many lockouts in a short window, investigate for a brute-force attempt — check `audit_logs` for repeated `auth.loginFailed` entries from the same IP.

---

## Resetting a password manually

### Preferred: self-service flow

Direct the user to `/forgot-password`. They will receive a signed token by email and can reset their password without operator intervention. The token expires after a fixed window (typically 1 hour).

### Manual SQL reset (emergency use only)

1. Generate a new bcrypt hash (see §Password hashing above).
2. Update the database:

```sql
UPDATE users
SET password_hash = '$2b$12$...new-hash...',
    updated_at = NOW()
WHERE email = 'user@example.com';
```

3. Also invalidate any outstanding password reset tokens for the user:

```sql
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com')
  AND used_at IS NULL;
```

4. Communicate the new temporary password to the user securely and instruct them to change it immediately.

---

## Deactivating a user

Setting `is_active = false` prevents login without deleting the user record. This preserves all audit and history rows that reference the user.

```sql
UPDATE users
SET is_active = false,
    updated_at = NOW()
WHERE email = 'departing@example.com';
```

There is no soft-delete concept for users — deactivation is the canonical way to disable access.

To re-activate a user:

```sql
UPDATE users
SET is_active = true,
    updated_at = NOW()
WHERE email = 'returning@example.com';
```

---

## Changing a user's role

```sql
UPDATE users
SET role = 'ADMIN',  -- or EDITOR, VIEWER
    updated_at = NOW()
WHERE email = 'user@example.com';
```

**Important:** Role changes take effect on the user's next login. The existing JWT session will retain the old role until it expires or the user logs out and back in.

This action is audited. Write an audit log entry if the role change is made manually rather than through an application action:

```sql
INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_id, diff, created_at)
VALUES (
  gen_random_uuid(),
  'user.roleChanged',
  'User',
  (SELECT id FROM users WHERE email = 'user@example.com'),
  (SELECT id FROM users WHERE email = 'admin@inventory.local'),  -- the operator's user ID
  jsonb_build_object('role', jsonb_build_object('from', 'EDITOR', 'to', 'ADMIN')),
  NOW()
);
```

---

## Listing active sessions

Sessions in this application are **stateless JWTs** managed by NextAuth. There is no server-side session store in v1.0, so there is no session list to query.

To determine if a user is currently logged in, you can check for recent activity in the audit log:

```sql
SELECT actor_id, action, created_at
FROM audit_logs
WHERE actor_id = (SELECT id FROM users WHERE email = 'user@example.com')
ORDER BY created_at DESC
LIMIT 20;
```

### Force-logout all users

Because sessions are JWTs, the only way to immediately invalidate all sessions is to rotate `NEXTAUTH_SECRET`. This logs out every user simultaneously.

```bash
# Generate a new secret
openssl rand -hex 32

# Update .env.prod with the new secret
# Restart the app
docker compose --profile prod up -d --no-deps app
```

Inform users in advance if possible, as they will need to log in again.

### Force-logout a specific user (v1 limitation)

There is no mechanism in v1.0 to invalidate a single user's JWT without affecting others. Options:

1. Wait for the JWT to expire naturally (default session lifetime is configured in `src/server/auth/options.ts`).
2. Deactivate the user account — `is_active = false` check happens on each request through the session callback, so the user will be blocked immediately on their next API call even with a valid JWT.

Per-user session invalidation via a server-side blocklist is planned for a future release.
