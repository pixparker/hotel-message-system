# Cloud Deploy Runbook

Target stack (Task 9):
- **API + Worker**: Fly.io (separate apps: `hms-api`, `hms-worker`)
- **Postgres**: Neon (prod + staging branches)
- **Redis**: Upstash
- **Web**: Vercel (prod project distinct from the public demo)

Local `docker compose` stays for dev only.

---

## 1. First-time provisioning

### Neon (Postgres)

1. Create a project called `hms-prod`.
2. Create a second branch `staging` from `main`.
3. Grab the **pooled** connection string for each branch. Use the pooled
   endpoint (`-pooler.`) for the API/worker `DATABASE_URL` — Neon's serverless
   driver + pooling is what lets us run small machines.
4. Take note of the *unpooled* URL too — migrations require it because the
   pooler closes connections after each transaction, which can cut a migration
   mid-flight.

### Upstash (Redis)

1. Create a Global database `hms-prod`.
2. Enable eviction `noeviction` (BullMQ relies on persistent jobs).
3. Copy the TLS `rediss://` URL.

### Fly.io

```bash
fly auth signup  # once
fly apps create hms-api
fly apps create hms-worker
```

Set secrets for the API (staging/prod):

```bash
fly secrets set -c deploy/fly.api.toml \
  DATABASE_URL="<neon-pooled-url>" \
  REDIS_URL="<upstash-rediss-url>" \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  SECRETS_ENCRYPTION_KEY="$(openssl rand -base64 48)" \
  RESEND_API_KEY="re_..." \
  EMAIL_FROM="noreply@yourdomain.com" \
  WA_CLOUD_VERIFY_TOKEN="$(openssl rand -hex 16)" \
  API_PUBLIC_URL="https://api.yourdomain.com" \
  WEB_ORIGIN="https://app.yourdomain.com"
```

Worker uses the same DB + Redis + encryption key (it decrypts tenant tokens):

```bash
fly secrets set -c deploy/fly.worker.toml \
  DATABASE_URL="<neon-pooled-url>" \
  REDIS_URL="<upstash-rediss-url>" \
  SECRETS_ENCRYPTION_KEY="<same-as-api>" \
  WORKER_ORG_MSGS_PER_MINUTE="80"
```

> **Important**: `SECRETS_ENCRYPTION_KEY` MUST match between api and worker,
> or the worker won't be able to decrypt tenant tokens the api persisted.

### Vercel (Web, production)

1. Import the repo as a new Vercel project called `hms-web-prod`.
2. **Framework preset**: Other.
3. Build command (override): `pnpm --filter @hms/web build`
4. Output directory: `apps/web/dist`
5. Install command: `pnpm install --frozen-lockfile=false`
6. Environment variables (production scope):
   - `VITE_API_URL = https://api.yourdomain.com`
   - **Do NOT** set `VITE_DEMO` here — the public demo is a separate project.

The existing [vercel.json](../../vercel.json) at the repo root is for the
public demo project (sets `VITE_DEMO=1` at build time). Leave it alone.

---

## 2. Initial migration

Migrations run as a Fly release task on every deploy (see `fly.api.toml`). The
very first deploy migrates from an empty DB.

For staging → prod parity, apply migrations to staging first:

```bash
DATABASE_URL="<neon-staging-unpooled>" pnpm db:migrate
DATABASE_URL="<neon-prod-unpooled>"    pnpm db:migrate  # or via fly release
```

---

## 3. Deploy

From CI or locally:

```bash
# Deploys the api with release-task migration
fly deploy -c deploy/fly.api.toml --dockerfile deploy/Dockerfile.api

# Deploys the worker (no release task; stateless)
fly deploy -c deploy/fly.worker.toml --dockerfile deploy/Dockerfile.worker
```

Vercel auto-deploys on push to `main` for the web project.

---

## 4. Rollback

### API (if release task succeeded, bad code deployed)

```bash
fly releases -c deploy/fly.api.toml
fly releases rollback <version> -c deploy/fly.api.toml
```

### API (release task failed — migration was not applied)

The release task fails the deploy before traffic flips. No rollback needed;
the previous version keeps serving. Fix the migration and redeploy.

### API (release task succeeded but migration was bad)

Database rollback is **not** automatic. Either:
- Write and deploy a forward migration that reverses the bad one (preferred).
- Restore from Neon PITR (see [backups.md](backups.md) — Task 16) and redeploy
  the previous code tag.

### Worker

```bash
fly releases rollback <version> -c deploy/fly.worker.toml
```

### Web

Vercel → Deployments tab → promote a previous deployment.

---

## 5. Domain wiring

- `api.yourdomain.com` → Fly IPv4 + IPv6 A/AAAA from `fly ips list -c deploy/fly.api.toml`
- `app.yourdomain.com` → Vercel (add in project → Domains)
- Meta webhook callback URL: `https://api.yourdomain.com/api/webhooks/whatsapp`

Set Meta's verify token (GET handshake) to the value in `WA_CLOUD_VERIFY_TOKEN`.
Per-tenant signature verification uses each org's `appSecret` from the
connect wizard (Task 12).

---

## 6. CI → Deploy wiring (optional)

A GitHub Action can deploy on push to `main`. Not yet wired; candidates:

- [`superfly/flyctl-actions`](https://github.com/superfly/flyctl-actions)
- Vercel deploys on push automatically once the project is connected.

Needs `FLY_API_TOKEN` secret in the repo.

---

## 7. Dropping Caddy in prod

The [deploy/Caddyfile](../../deploy/Caddyfile) and [deploy/docker-compose.yml](../../deploy/docker-compose.yml)
are for single-VPS / on-premises installs. Fly handles TLS termination
natively, so prod does NOT use Caddy. Keep them in the repo for operators who
want to self-host.
