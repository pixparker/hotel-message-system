# MVP → Production

Task tracker for hardening the hotel-message-system demo into a multi-tenant SaaS.
Pick tasks top-to-bottom; each has scope + expectation + status.

## Context

- **Target**: multi-tenant SaaS in the cloud, outbound WhatsApp campaigns only.
- **First real provider**: Meta Cloud API (mock stays for dev/CI).
- **Window**: 2–4 weeks, ship a defensible v1.
- **Architecture**: locked decisions in [architecture-decisions.md](architecture-decisions.md). Read it before starting.

## Read this before picking a task

| Doc | What's in it |
| --- | --- |
| [architecture-decisions.md](architecture-decisions.md) | The 8 locked decisions (tenancy, auth, secrets, WA, queue, deploy, observability, testing) — what / why / how. |
| [../plan-1.md](../plan-1.md) | Original MVP architecture doc — data model, flows, module layout. |
| [../ui-specification.md](../ui-specification.md) | UI flows, wizard steps, screen-level spec. |
| [../../README.md](../../README.md) | Quick start: clone, `docker compose`, seed, run. |
| [../../deploy/README.md](../../deploy/README.md) | Deploy notes for the docker-compose stack. |
| [../../packages/db/src/schema.ts](../../packages/db/src/schema.ts) | Drizzle schema — the source of truth for the data model. |
| [../../.env.example](../../.env.example) | Full env surface (DB, Redis, JWT, WA, bootstrap). |
| [../../turbo.json](../../turbo.json) · [../../pnpm-workspace.yaml](../../pnpm-workspace.yaml) | Monorepo layout and pipeline. |

## Entry points by area

| Area | File |
| --- | --- |
| API server | [apps/api/src/main.ts](../../apps/api/src/main.ts) |
| API auth | [apps/api/src/auth.ts](../../apps/api/src/auth.ts) |
| API routes | [apps/api/src/routes/](../../apps/api/src/routes/) |
| Worker | [apps/worker/src/main.ts](../../apps/worker/src/main.ts) |
| Web app | [apps/web/src/App.tsx](../../apps/web/src/App.tsx) · [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts) |
| Demo backend (stripped in prod) | [apps/web/src/lib/demo-backend.ts](../../apps/web/src/lib/demo-backend.ts) |
| Shared schemas (Zod) | [packages/shared/src/schemas.ts](../../packages/shared/src/schemas.ts) |
| WhatsApp drivers | [packages/wa-driver/src/](../../packages/wa-driver/src/) |
| DB migrations + seed | [packages/db/src/](../../packages/db/src/) |

## Status legend

- `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Stage 1 — Foundation (week 1)

### 1. [x] Secrets rotation + env schema
**Scope**: Shared Zod schema at [packages/shared/src/env.ts](../../packages/shared/src/env.ts) (`loadServerEnv`, `loadWebEnv`, `requireDatabaseUrl`). Wired into [apps/api/src/env.ts](../../apps/api/src/env.ts), [apps/worker/src/env.ts](../../apps/worker/src/env.ts), [apps/web/src/lib/env.ts](../../apps/web/src/lib/env.ts). Strict `DATABASE_URL` in [drizzle.config.ts](../../packages/db/drizzle.config.ts) and [migrate.ts](../../packages/db/src/migrate.ts). Conditional refine: `WA_PROVIDER=cloud` requires cloud credentials; JWT secrets must differ in production and be ≥32 chars. Rotation runbook at [docs/runbook/secrets-rotation.md](../runbook/secrets-rotation.md).
**Expectation**: api and worker refuse to start with missing/invalid env. No secret values remain in git history going forward (document rotation; history rewrite not required).

### 2. [x] Row-Level Security + tenant query helper
**Scope**: Denormalized `org_id` onto `messages` + `template_bodies` to keep policies trivial. Migration [0003_rls_tenant_isolation.sql](../../packages/db/migrations/0003_rls_tenant_isolation.sql) backfills, enables RLS, and adds `tenant_isolation` policies on all 8 tenant tables using `nullif(current_setting('app.current_org', TRUE), '')::uuid`. Added [apps/api/src/tenant.ts](../../apps/api/src/tenant.ts) exposing `withTenant` middleware, `runAsTenant`, and `TenantDb`. Routes carry a transactional `c.var.db`. Login uses SECURITY DEFINER function `auth_find_user_by_email` (has no tenant context yet); worker embeds `orgId` in job payloads and wraps each send + status update in `asTenant`. Proven locally via a non-owner probe role: no-context → 0 rows; real org → full rows; foreign org → 0 rows.
**Expectation**: integration test proves a tenant-A token cannot read tenant-B rows even if the query omits `where org_id`. All existing routes keep working.
**Follow-up**: full enforcement requires a non-owner app role with FORCE ROW LEVEL SECURITY on tables (task 9 cloud deploy) and a dedicated test role with isolation assertions (task 15 tests). Policies and infrastructure are ready.

### 3. [x] Refresh tokens + email verification + password reset
**Scope**: Migration [0004_auth_tokens_email_verification.sql](../../packages/db/migrations/0004_auth_tokens_email_verification.sql) adds `refresh_tokens` (jti PK, userId, orgId, expiresAt, revokedAt, replacedBy), `email_verification_tokens`, `password_reset_tokens`, and `users.email_verified`. Six SECURITY DEFINER functions (`auth_get_refresh_token`, `auth_rotate_refresh_token`, `auth_revoke_all_for_user`, `auth_use_email_verification_token`, `auth_use_password_reset_token`) handle pre-tenant token operations. New endpoints: `/auth/register`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`. `/auth/login` and `/auth/refresh` rewritten with jti tracking + rotation + reuse detection (revokes all sessions on replay). [apps/api/src/auth.ts](../../apps/api/src/auth.ts) adds `emailVerified`+`jti` to claims and a `requireVerified` middleware (wired on `/api/campaigns`). [apps/api/src/mailer.ts](../../apps/api/src/mailer.ts) wraps Resend with a console fallback for dev. Frontend: silent token refresh in [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts), three new public pages ([forgot-password](../../apps/web/src/routes/forgot-password.tsx), [reset-password](../../apps/web/src/routes/reset-password.tsx), [verify-email](../../apps/web/src/routes/verify-email.tsx)), `setTokens` action on auth store. Committed in `fd7ba6a`.
**Expectation**: flows work end-to-end in staging. Revoked refresh token cannot mint a new access token. Unverified users cannot send messages.

### 4. [x] Webhook signature verification
**Scope**: Migration [0005_webhook_signature_verification.sql](../../packages/db/migrations/0005_webhook_signature_verification.sql) extends `webhook_events` with `org_id`, `rejected`, `rejection_reason` and adds SECURITY DEFINER function `webhook_find_settings_by_phone_number_id` for pre-tenant lookup. [apps/api/src/routes/webhooks.ts](../../apps/api/src/routes/webhooks.ts) POST handler rewritten: reads raw body (for HMAC verification), extracts `phone_number_id` from Meta payload, looks up tenant, verifies `X-Hub-Signature-256` with `crypto.timingSafeEqual`. Returns 400 on malformed/missing fields, 404 on unknown phone_number_id, 401 on invalid signature, 200 when verified. All rejections persisted to `webhook_events` with reason. Formalized `waConfigSchema` in [packages/shared/src/schemas.ts](../../packages/shared/src/schemas.ts) with typed fields (phoneNumberId, wabaId, accessToken, appSecret). Also fixed a pre-existing Hono middleware leak: sseRoutes's `.use(requireAuth)` was applied to all `/api/*` paths through `app.route("/api", sseRoutes)`; moved to route-scoped middleware. Committed in `501692a`.
**Expectation**: tampered payloads are rejected; audit log entry written on rejection.

### 5. [x] Rate limiting
**Scope**: New [apps/api/src/rate-limit.ts](../../apps/api/src/rate-limit.ts) implements a fixed-window Redis-backed limiter with fail-open on Redis errors. Applied per-IP to `/api/auth/*` (10 req/min) and per-org to `/api/campaigns` (30 req/min). `Retry-After` header returned on 429. CSV import limiter will be added with Task 13.
**Expectation**: brute-force login is throttled; one abusive org cannot starve the queue for others.

---

## Stage 2 — Real WhatsApp + platform (week 2)

### 6. [x] Meta Cloud API driver
**Scope**: New [packages/wa-driver/src/cloud.ts](../../packages/wa-driver/src/cloud.ts) implements `CloudWaDriver` using Meta Graph API v22.0. `sendText` posts to `/{phoneNumberId}/messages`; `CloudApiError` classifies errors (429 + 5xx retryable, 4xx terminal). `handleWebhook(payload)` parses `entry[].changes[].value.statuses[]` and `.messages[]`, emitting `StatusEvent`s and `InboundMessage`s to registered handlers. Factory accepts `{ cloud: { accessToken, phoneNumberId } }`. Worker now resolves one driver per org on demand from `settings.waConfig` (mock stays shared; cloud is per-tenant). Webhook handler publishes verified payloads to Redis `wa:webhook`; worker subscribes and dispatches to the right org's cloud driver. Full cloud e2e needs Meta sandbox credentials.
**Expectation**: staging campaign of 50 messages delivers via Meta sandbox, statuses land back via webhook, errors are classified correctly.

### 7. [x] Template approval workflow
**Scope**: Migration [0008_template_approval.sql](../../packages/db/migrations/0008_template_approval.sql) adds `templates.external_name`, `templates.approval_status` (`draft|pending|approved|rejected` enum), `templates.last_synced_at`. New `POST /api/templates/:id/submit` endpoint moves status to `pending` (admin only). [apps/worker/src/template-sync.ts](../../apps/worker/src/template-sync.ts) runs `startTemplateSyncLoop` every 5 minutes: for each cloud tenant, fetches Meta's `/{wabaId}/message_templates`, matches by `external_name`, and flips local status to `approved`/`rejected`. Campaign create in [apps/api/src/routes/campaigns.ts](../../apps/api/src/routes/campaigns.ts) blocks with 400 `template_not_approved` when `waProvider === "cloud"` and the template isn't approved (mock provider is free-form). UI badge can be added when the connect wizard (Task 12) surfaces cloud setup.
**Expectation**: a template submitted in-app shows up in Meta Business Manager; once approved there, in-app status flips within the next sync tick.

### 8. [x] BullMQ per-org fairness + idempotency
**Scope**: Migration [0007_messages_idempotency.sql](../../packages/db/migrations/0007_messages_idempotency.sql) adds `messages.idempotency_key` with a unique index on (org_id, idempotency_key). Campaign rows use `{campaignId}:{guestId}`; test sends use `test:{campaignId}`. [apps/worker/src/main.ts](../../apps/worker/src/main.ts) now: (a) checks idempotency pre-send — if `providerMessageId` is set and status != queued, skip; (b) applies a per-org Redis token bucket before every send (`worker:rl:{orgId}`, default 80/min, configurable via `WORKER_ORG_MSGS_PER_MINUTE`). When over quota, the job is delayed 1-5s (with jitter) and re-enqueued so another tenant's work can proceed.
**Expectation**: forced worker crash mid-campaign resumes without duplicate deliveries; one org's 10k blast doesn't delay another org's test send by more than a few seconds.

### 9. [ ] Cloud deploy
**Scope**: Fly apps for api + worker (`fly.api.toml`, `fly.worker.toml`), Neon Postgres (prod + staging branches), Upstash Redis. Vercel web in non-demo mode pointing at `api.<domain>`. Migration runs as Fly release task. Drop Caddy from prod (Fly handles TLS); keep compose for local dev only.
**Expectation**: push to main deploys api+worker to Fly and web to Vercel; rollback path documented.

### 10. [ ] Observability baseline
**Scope**: Pino log drain to Axiom or BetterStack. Sentry SDK in api/worker/web with `organization_id` tag. OTel traces on `POST /campaigns → queue → send → webhook`. One dashboard: queue depth, p95 send latency, error rate, Meta 4xx/5xx.
**Expectation**: a forced error in staging appears in Sentry with the org tag; the dashboard shows a live campaign run.

---

## Stage 3 — Onboarding + hardening (week 3)

### 11. [ ] Self-serve signup flow + sample data pack
**Scope**:
- `/signup` page → create org + admin user (pending verification) → verify email → land in dashboard with onboarding checklist. Add `organizations.onboardingState` jsonb to drive the checklist UI.
- Refactor existing hardcoded seed ([packages/db/src/seed.ts](../../packages/db/src/seed.ts)) into a reusable **sample-data fixture** at `packages/db/src/fixtures/sample-hotel.json` (15 guests, 2–3 templates, one past campaign). Used by signup *and* tests.
- Signup form has an opt-in checkbox: "Populate with sample data so I can explore" — on accept, clone the fixture into the new org. Staff can delete anytime via Settings.
- Public marketing demo on Vercel (`VITE_DEMO=1`) stays as-is — no-auth, no DB, separate from prod.

**Expectation**: a new user can go from landing page to verified dashboard without operator involvement. With the checkbox, they see a populated workspace on first login instead of an empty shell.

### 12. [ ] Guided WhatsApp connect wizard
**Scope**: Settings → "Connect WhatsApp" → paste `phoneNumberId`, `wabaId`, access token, app secret → run a test send to the admin's phone → persist encrypted config. Access token encrypted with pgcrypto at column level.
**Expectation**: a fresh org can reach "first real message delivered" in under 10 minutes.

### 13. [ ] CSV guest import hardening
**Scope**: Upload → preview (dry-run) → validation report (phone normalization, dup detection, row errors) → confirm → import. Background job for >1k rows.
**Expectation**: a 5k-row CSV imports without blocking the UI and reports bad rows precisely.

### 14. [x] Audit log
**Scope**: Migration [0006_audit_events.sql](../../packages/db/migrations/0006_audit_events.sql) creates `audit_events` (orgId, userId, action, target, metadata jsonb, ip, user_agent, created_at) with RLS tenant isolation and a `audit_log_event` SECURITY DEFINER helper for pre-tenant writes. [apps/api/src/audit.ts](../../apps/api/src/audit.ts) exposes a non-throwing `auditLog()` helper + `auditContext(c)` extractor. Wired into: `auth.login` (success), `auth.login_failed` (bad email/password), `auth.register`, `campaign.create`, `settings.update` (logs changed keys, not values — redacts secrets). New admin-only `GET /api/audit?limit=50&action=foo` endpoint at [apps/api/src/routes/audit.ts](../../apps/api/src/routes/audit.ts). Done early so Tasks 11-13 write events from the start.
**Expectation**: an admin can answer "who sent campaign X?" from one query.

### 15. [ ] Test suite + CI
**Scope**: Vitest unit coverage for schemas, template renderer, phone normalization, driver contracts. Integration tests against testcontainers Postgres for auth, RLS isolation, campaign send with mock driver. One Playwright smoke: login → create campaign → see delivered. GitHub Actions workflow: lint + typecheck + test + build on PR; deploy on main.
**Expectation**: CI runs under 10 min; RLS negative test is green; Playwright smoke is green against ephemeral stack.

---

## Stage 4 — Launch polish (week 4 / buffer)

### 16. [ ] Backups + runbook
**Scope**: Enable Neon PITR. Document: rotate a WA token, re-drive a failed campaign, revoke a user, restore DB to a point in time, bump Meta tier.
**Expectation**: on-call can execute each runbook without tribal knowledge.

### 17. [ ] Status page + uptime monitor
**Scope**: Health checks on api and worker queue depth. BetterStack or equivalent monitor on `api.<domain>/health`. Public status page optional.
**Expectation**: outages page on-call within 2 minutes.

### 18. [ ] Load test + throughput tuning
**Scope**: Simulate a 5k-message campaign against Meta sandbox. Tune BullMQ concurrency, DB pool size, Meta tier.
**Expectation**: documented throughput ceiling per tier; worker stays under target memory/CPU.

### 19. [ ] Security review pass
**Scope**: `pnpm audit` clean or documented exceptions; CSP on web; secure cookie flags; CORS allowlist; response-time-equal login errors; protected routes 401 without auth and 404 (not 403) on cross-tenant reads.
**Expectation**: checklist ticked; findings either fixed or filed with severity.

---

## How we'll work this

- Pick the next `[ ]` task, flip it to `[~]`, and implement.
- Each task ships as its own PR where practical.
- When a task is done, flip to `[x]` and note the PR in the scope line.
- If a task reveals a structural issue that changes the plan, update this file in the same PR — don't let the plan drift silently.
