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

### 3. [ ] Refresh tokens + email verification + password reset
**Scope**: New `refresh_tokens` table (jti, userId, orgId, expiresAt, revokedAt, replacedBy). Rotate on every refresh; revoke the chain on reuse. Add `/auth/register` (creates org + first admin, pending verification), `/auth/verify-email`, `/auth/forgot`, `/auth/reset`. Transactional email via Resend or Postmark.
**Expectation**: flows work end-to-end in staging. Revoked refresh token cannot mint a new access token. Unverified users cannot send messages.

### 4. [ ] Webhook signature verification
**Scope**: `POST /api/webhooks/wa` verifies Meta `X-Hub-Signature-256` using the per-tenant app secret read from `settings.waConfig`. Reject unknown `phone_number_id` with 404.
**Expectation**: tampered payloads are rejected; audit log entry written on rejection.

### 5. [ ] Rate limiting
**Scope**: per-IP limiter on `/auth/*` (login, register, forgot) and per-org limiter on `/campaigns` + `/guests/import`. Redis-backed.
**Expectation**: brute-force login is throttled; one abusive org cannot starve the queue for others.

---

## Stage 2 — Real WhatsApp + platform (week 2)

### 6. [ ] Meta Cloud API driver
**Scope**: Implement `packages/wa-driver/src/cloud.ts` — template send, parameter substitution, error mapping (429/5xx → retryable, 4xx → terminal), status parsing from webhook. Keep mock driver for CI. Factory reads provider + credentials from tenant settings.
**Expectation**: staging campaign of 50 messages delivers via Meta sandbox, statuses land back via webhook, errors are classified correctly.

### 7. [ ] Template approval workflow
**Scope**: Add `templates.externalName`, `templates.approvalStatus` (`draft|pending|approved|rejected`), and a scheduled job that syncs approval status from Meta. UI shows status badge. Campaign create blocks if template is not `approved`.
**Expectation**: a template submitted in-app shows up in Meta Business Manager; once approved there, in-app status flips within the next sync tick.

### 8. [ ] BullMQ per-org fairness + idempotency
**Scope**: Worker uses per-org rate limiter (derived from Meta tier in settings). Add `messages.idempotencyKey` (unique on `campaignId + guestId`). Retries never double-send.
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

### 14. [ ] Audit log
**Scope**: `audit_events` table (orgId, userId, action, target, metadata, ip, ua, ts). Write on login, signup, campaign create/send, settings change, guest import/export, user invite.
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
