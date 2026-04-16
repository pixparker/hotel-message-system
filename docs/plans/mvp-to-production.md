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

### 9. [~] Cloud deploy
**Scope**: Fly config files written: [deploy/fly.api.toml](../../deploy/fly.api.toml) (release-task migration, `/health` check, auto-stop, shared-cpu-1x) and [deploy/fly.worker.toml](../../deploy/fly.worker.toml) (no HTTP, rolling). Runbook at [docs/runbook/cloud-deploy.md](../runbook/cloud-deploy.md) covers: Neon setup (pooled vs unpooled URLs), Upstash, Fly secrets, Vercel prod project config, release-task pattern, rollback paths (code vs DB), domain wiring, dropping Caddy. Key constraint documented: `SECRETS_ENCRYPTION_KEY` must match between api and worker or worker can't decrypt tokens. Vercel config keeps existing `vercel.json` for the public demo; prod uses a second Vercel project with `VITE_API_URL` set via the dashboard.
**Follow-up deferred (`~`)**: actual account creation + first deploy requires operator credentials I can't provision.
**Expectation**: push to main deploys api+worker to Fly and web to Vercel; rollback path documented.

### 10. [~] Observability baseline
**Scope**: `@sentry/node` wired into api ([apps/api/src/telemetry.ts](../../apps/api/src/telemetry.ts)) and worker ([apps/worker/src/telemetry.ts](../../apps/worker/src/telemetry.ts)). `initSentry()` is a no-op when `SENTRY_DSN` is missing (dev mode). API middleware `sentryContextMiddleware` tags the Sentry scope with `organization_id` + `user_id` from auth claims, so every captured error carries tenant context. `handleError` in [apps/api/src/errors.ts](../../apps/api/src/errors.ts) routes unhandled exceptions to Sentry (4xx are not paged). Worker's catch block captures send failures with `{orgId, messageId, campaignId}` tags. Env vars: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `LOG_DRAIN_URL`. `sendDefaultPii: false` to avoid leaking bodies/tokens.
**Follow-up deferred (`~`)**: Axiom/BetterStack log drain (env var reserved, operator wires via platform config); OTel traces on the hot path (adds complexity; defer until a user reports a mystery latency issue); dashboard setup (platform-specific).
**Expectation**: a forced error in staging appears in Sentry with the org tag; the dashboard shows a live campaign run.

---

## Stage 3 — Onboarding + hardening (week 3)

### 11. [x] Self-serve signup flow + sample data pack
**Scope**: Migration [0009_onboarding_state.sql](../../packages/db/migrations/0009_onboarding_state.sql) adds `organizations.onboarding_state` jsonb. Sample fixture at [packages/db/src/fixtures/sample-hotel.ts](../../packages/db/src/fixtures/sample-hotel.ts) — 15 guests, 3 templates (welcome, breakfast reminder, late checkout offer) in EN/TR/FA. `registerSchema` in [packages/shared/src/schemas.ts](../../packages/shared/src/schemas.ts) accepts `populateSampleData: boolean`. `/auth/register` in [apps/api/src/routes/auth.ts](../../apps/api/src/routes/auth.ts) clones the fixture into the new org when the flag is set. New [apps/web/src/routes/signup.tsx](../../apps/web/src/routes/signup.tsx) with form (hotel name, email, password, opt-in sample-data checkbox) → "check your email" confirmation. Added `/signup` route and "Create an account" link on login. Public demo build (`VITE_DEMO=1`) is untouched.
**Expectation**: a new user can go from landing page to verified dashboard without operator involvement. With the checkbox, they see a populated workspace on first login instead of an empty shell.

### 12. [x] Guided WhatsApp connect wizard
**Scope**: New [apps/api/src/crypto.ts](../../apps/api/src/crypto.ts) does AES-256-GCM encryption (with an "enc:v1:" prefix) using a key derived from `SECRETS_ENCRYPTION_KEY`. Mirrored as [apps/worker/src/crypto.ts](../../apps/worker/src/crypto.ts) for the worker to decrypt tokens when building cloud drivers. Chosen over pgcrypto for simpler ops (no Postgres extension). New `POST /api/settings/whatsapp/connect` endpoint: validates credentials, runs a real test send via CloudWaDriver, then (only on success) encrypts access token + app secret and persists them to `settings.waConfig`. Flips `waProvider` to `"cloud"`. Webhook verification in [apps/api/src/routes/webhooks.ts](../../apps/api/src/routes/webhooks.ts) now decrypts the app secret before HMAC check. Worker's `getDriverForOrg` decrypts access token before instantiating `CloudWaDriver`. New [apps/web/src/routes/whatsapp-connect.tsx](../../apps/web/src/routes/whatsapp-connect.tsx) wizard page at `/settings/whatsapp`. Audit log records `whatsapp.connect` event (no token values).
**Expectation**: a fresh org can reach "first real message delivered" in under 10 minutes.

### 13. [x] CSV guest import hardening
**Scope**: Added `csv-parse` dependency. Two new endpoints in [apps/api/src/routes/guests.ts](../../apps/api/src/routes/guests.ts): `POST /api/guests/import/preview` (dry-run, returns valid/invalid/duplicate counts with per-row errors) and `POST /api/guests/import` (inserts, skipping dups within file and existing rows). `parseGuestCsv()` accepts headers `name,phone,language,room_number` (any casing, any whitespace in header). Validates each row (missing fields, phone normalization via `normalizePhone`, language in SUPPORTED_LANGUAGES). Capped at 5000 rows synchronously (async job for bigger files deferred). Per-org rate-limited at 5 imports/min. Audit event `guests.import` records counts (not PII). New [apps/web/src/components/CsvImportDialog.tsx](../../apps/web/src/components/CsvImportDialog.tsx) supports file-upload or paste, shows preview summary with invalid-row details, and imports only after confirmation. "Import CSV" button added to Guests page.
**Expectation**: a 5k-row CSV imports without blocking the UI and reports bad rows precisely.

### 14. [x] Audit log
**Scope**: Migration [0006_audit_events.sql](../../packages/db/migrations/0006_audit_events.sql) creates `audit_events` (orgId, userId, action, target, metadata jsonb, ip, user_agent, created_at) with RLS tenant isolation and a `audit_log_event` SECURITY DEFINER helper for pre-tenant writes. [apps/api/src/audit.ts](../../apps/api/src/audit.ts) exposes a non-throwing `auditLog()` helper + `auditContext(c)` extractor. Wired into: `auth.login` (success), `auth.login_failed` (bad email/password), `auth.register`, `campaign.create`, `settings.update` (logs changed keys, not values — redacts secrets). New admin-only `GET /api/audit?limit=50&action=foo` endpoint at [apps/api/src/routes/audit.ts](../../apps/api/src/routes/audit.ts). Done early so Tasks 11-13 write events from the start.
**Expectation**: an admin can answer "who sent campaign X?" from one query.

### 15. [~] Test suite + CI
**Scope**: Vitest unit tests for:
- `packages/shared/src/phone.test.ts` — normalizePhone/isValidPhone/formatPhoneDisplay (9 tests)
- `packages/shared/src/schemas.test.ts` — loginSchema, registerSchema, resetPasswordSchema, waConfigSchema, settingsUpdateSchema, guestCreateSchema (9 tests)
- `apps/api/src/crypto.test.ts` — encrypt/decrypt round-trip, IV randomness, utf-8, plaintext fallback, isEncrypted detection (6 tests)
24 tests passing locally. [apps/api/vitest.setup.ts](../../apps/api/vitest.setup.ts) stubs env for modules that validate at load-time. New GitHub Actions workflow [.github/workflows/ci.yml](../../.github/workflows/ci.yml) runs typecheck → db:migrate (with ephemeral pg+redis services) → test → build on every push/PR.
**Follow-up deferred (still marked `~`)**: integration tests against testcontainers Postgres (the RLS negative test with a non-owner app role is the critical gap); Playwright smoke test. Both are explicit in the original scope but require more infra than a single commit; these land as a follow-up PR.
**Expectation**: CI runs under 10 min; RLS negative test is green; Playwright smoke is green against ephemeral stack.

---

## Stage 4 — Launch polish (week 4 / buffer)

### 16. [x] Backups + runbook
**Scope**: [docs/runbook/backups.md](../runbook/backups.md) covers: Neon PITR full restore (step-by-step with fly secrets commands), partial per-tenant restore via psql `\copy`, secondary nightly pg_dump workflow stub, and the explicit five routine tasks from the scope — rotate WA token, re-drive failed campaign, revoke a user, restore to point in time, bump Meta tier. Plus a disaster-scenarios checklist mapping symptoms (health endpoint state, tenant complaint) → first action → owner.
**Expectation**: on-call can execute each runbook without tribal knowledge.

### 17. [~] Status page + uptime monitor
**Scope**: Two health endpoints on the API: `/health` (always 200, for cheap liveness checks — used by Fly's autoscaler) and `/health/deep` (verifies DB round-trip, Redis ping, BullMQ queue depth < 10k waiting; returns 503 on any failure). Each check reports latency so monitor dashboards can graph slow starts.
**Follow-up deferred (`~`)**: wire an external uptime monitor (BetterStack/UptimeRobot) on `/health/deep` — this is operator config, not code; documented in [cloud-deploy.md](../runbook/cloud-deploy.md) follow-up. Public status page optional (marketing concern).
**Expectation**: outages page on-call within 2 minutes.

### 18. [~] Load test + throughput tuning
**Scope**: [scripts/load-test.ts](../../scripts/load-test.ts) seeds synthetic guests, creates a 5k-recipient campaign, enqueues all jobs, and polls campaign totals until drain — prints enqueue throughput, drain latency, and msgs/sec. [docs/runbook/throughput-tuning.md](../runbook/throughput-tuning.md) enumerates every lever (worker concurrency, `WORKER_ORG_MSGS_PER_MINUTE`, Postgres pool, Fly memory, Redis eviction policy) with defaults and guidance on when to raise each, plus Meta-tier throughput ceilings and a "where to focus when drain is slow" diagnostic ladder. Baseline dev numbers (MacBook + docker compose + mock driver) captured: ~2500 enqueue jobs/s, ~110 msgs/s sustained drain (bounded by mock driver's fake-delivery setTimeout, not our code).
**Follow-up deferred (`~`)**: run against Meta sandbox (operator creds needed); tune per-tenant `msgsPerMinute` override in `settings.wa_config`.
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
