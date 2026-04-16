# Backups & Point-In-Time Recovery

Target: any single operator action (bad migration, accidental DELETE, runaway
job) must be recoverable inside 30 minutes. Per-tenant recovery in under 60.

---

## 1. Neon Point-In-Time Recovery (PITR)

Neon tracks WAL for the retention period configured on the project (default:
24h free, 7d pro, 30d enterprise). **Verify `retention_horizon` is ≥ 7 days
on the prod branch before go-live.**

To check current retention:

```bash
# From the Neon dashboard → Settings → Storage → "History retention"
```

### Recover to a timestamp

1. Identify the moment the incident occurred (Sentry alert time, alert
   timestamp on PagerDuty, last good deploy).
2. In Neon dashboard → **Branches** → `main` → "Restore" → "To a point in time".
3. Pick timestamp ~30 seconds BEFORE the incident (transactions after the
   incident are discarded).
4. Choose "Create new branch" named `restore-YYYYMMDD-HHMM`.
5. Note the new branch's pooled connection string.
6. Flip api + worker `DATABASE_URL` to the new branch:
   ```bash
   fly secrets set -c deploy/fly.api.toml DATABASE_URL="<new-branch-url>"
   fly secrets set -c deploy/fly.worker.toml DATABASE_URL="<new-branch-url>"
   ```
7. `fly deploy` each to pick up the new secret (or restart: `fly machine restart`).
8. Verify with a sanity check (login, recent campaign totals match
   pre-incident).
9. Once confirmed, delete or archive the old branch.

### Recover a single tenant (partial restore)

When a single customer accidentally deletes their data, we don't want to roll
back everyone. Use a Neon restore branch + targeted copy:

1. Create a restore branch from before the incident (same as above).
2. Connect to BOTH branches: `psql <current>` and `psql <restore>`.
3. Copy the org's rows over (Drizzle models → plain `INSERT … SELECT FROM
   dblink(…)` or export-import via psql `\copy`).

Example (guests table, single org):

```sql
-- On the restore branch:
\copy (SELECT * FROM guests WHERE org_id = '<orgId>') TO '/tmp/guests.csv' WITH CSV HEADER

-- On the current branch:
DELETE FROM guests WHERE org_id = '<orgId>';  -- if partial restore required
\copy guests FROM '/tmp/guests.csv' WITH CSV HEADER
```

Do the same for `templates`, `template_bodies`, `campaigns`, `messages`,
`settings`, `audit_events`. Leave `users` + `organizations` alone unless
explicitly asked to restore them (cascade risks).

---

## 2. Logical backups (secondary, belt + suspenders)

Automated nightly `pg_dump` via a GitHub Action to encrypted S3/R2:

```yaml
# .github/workflows/backup.yml (not yet wired)
on:
  schedule: [{ cron: "0 3 * * *" }]  # 03:00 UTC
  workflow_dispatch:
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - run: pg_dump "$DATABASE_URL" | gzip > hms-$(date +%F).sql.gz
      - run: aws s3 cp hms-*.sql.gz s3://hms-backups/ --sse=AES256
```

---

## 3. Routine runbook tasks

### Rotate a WA access token (operator-facing)

A tenant's Meta token expires / is revoked. In-app path:

1. Admin visits `/settings/whatsapp`.
2. Pastes new access token + re-enters app secret.
3. Clicks "Test & Connect" — we send a test message with the new creds.
4. On success, we overwrite `settings.wa_config.accessToken` (encrypted).

From operator console, if a tenant can't log in:

```sql
-- Clear their waConfig.accessToken so they're forced to re-enter:
UPDATE settings
SET wa_config = wa_config - 'accessToken',
    updated_at = now()
WHERE org_id = '<orgId>';
```

### Re-drive a failed campaign

A campaign has `status = 'sending'` but many `messages` are `status = 'failed'`
because of a transient Meta outage.

```sql
-- Re-queue failed messages. Idempotency keys (task 8) ensure no double-send.
UPDATE messages
SET status = 'queued', error = NULL, provider_message_id = NULL
WHERE campaign_id = '<campaignId>' AND status = 'failed';
```

Then bump the BullMQ queue via `bull-board` (future), or trigger jobs by
inserting via the api:

```bash
# No public endpoint yet. For MVP: restart the worker with a backfill script.
```

### Revoke a user (immediate logout)

```sql
-- Revoke all refresh tokens (cuts active sessions on next /refresh).
SELECT auth_revoke_all_for_user('<userId>');

-- Optionally delete the user:
DELETE FROM users WHERE id = '<userId>';  -- cascades to refresh_tokens, campaigns.created_by SET NULL
```

### Bump a tenant's Meta tier (throughput)

Meta tiers (Tier 1 = 1k/day, Tier 2 = 10k, Tier 3 = 100k, unlimited after
approval). Our worker rate-limit defaults to 80/min (Tier 1). When a tenant
graduates:

```sql
-- Set per-tenant override (add column in a future migration, or use env
-- WORKER_ORG_MSGS_PER_MINUTE for global bump).
UPDATE settings SET wa_config = wa_config || '{"msgsPerMinute":800}'::jsonb
WHERE org_id = '<orgId>';
```

(Worker `acquireOrgToken` reads from settings; today it uses only the env
default. Wire the per-tenant override when the first tenant graduates.)

### Restore DB to a point in time

See **§1 Neon PITR** above.

---

## 4. Disaster scenarios checklist

| Scenario | First action | Owner |
|---|---|---|
| `/health/deep` reports DB down | Check Neon dashboard; if incident, wait | on-call |
| `/health/deep` reports queue > 10k waiting | Add a worker replica (`fly scale -c deploy/fly.worker.toml count=3`) | on-call |
| A tenant reports "my messages disappeared" | Restore from Neon branch (see §1) | platform |
| Leaked `SECRETS_ENCRYPTION_KEY` | **Critical.** Rotate key → re-encrypt all `settings.wa_config.accessToken` / `.appSecret` via a one-off migration | security |
| Meta suspends a tenant's number | Not our problem — direct them to Meta support. Disable sends in app with: `UPDATE settings SET wa_provider='mock' WHERE org_id=…` | ops |
