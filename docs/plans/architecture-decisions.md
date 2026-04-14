# Architecture Decisions

The calls we've locked in for the v1 SaaS build. One section per decision — what, why, how.

Background: original MVP design in [plan-1.md](../plan-1.md). Task breakdown in [mvp-to-production.md](mvp-to-production.md).

---

## 1. Tenancy — shared Postgres with RLS

**Decision**: One shared Postgres. Every row carries `organization_id`. Postgres Row-Level Security enforces isolation as a second line of defense.

**Why**: Cheapest to operate. App-layer scoping can be forgotten — RLS turns that mistake into a no-op instead of a data leak.

**How**: Drizzle migration enables RLS + policies per table. API middleware runs `SET LOCAL app.current_org = <id>` per request after auth.

**Rejected**: schema-per-tenant (migration hell), instance-per-tenant (kills SaaS economics).

---

## 2. Auth — JWT with DB-backed refresh tokens

**Decision**: Keep the current JWT setup. Add a `refresh_tokens` table for rotation + revocation. Add email verification and password reset.

**Why**: A full swap to Clerk/Supabase Auth/WorkOS doesn't fit the 2–4 week window. Hardening what exists gets us to production faster. Revisit at v2.

**How**: Refresh tokens are rotated on every use; reuse of an old token revokes the whole chain. Unverified users can sign in but can't send messages.

---

## 3. Secrets — env schema validated at boot, prod values in a secret store

**Decision**: Zod schema in `packages/shared/src/env.ts` parses env at boot. Production secrets live in the platform secret store (Doppler or Fly secrets), never in `.env`.

**Why**: Current `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are in git. That's the single biggest security gap today.

**How**: api and worker refuse to start on invalid env. Rotate everything currently committed; document rotation in the runbook (no git history rewrite).

---

## 4. WhatsApp — one webhook, per-tenant config

**Decision**: Single public webhook endpoint routes inbound events to the right tenant by `phone_number_id`. Credentials + app secret live on `settings.waConfig` per org.

**Why**: Each Meta app has its own signing secret. Routing in code keeps the infra simple and the isolation clean.

**How**: `POST /api/webhooks/wa` looks up the org by `phone_number_id`, verifies `X-Hub-Signature-256` with that org's app secret, then dispatches. Template approval status is tracked in DB and synced from Meta.

---

## 5. Queue — single Redis + BullMQ with per-org fairness

**Decision**: Keep one shared Redis. Each job carries `organizationId`. Per-org rate limiter derived from the tenant's Meta tier. Idempotency key on every message.

**Why**: One org's 10k-message blast must not starve another org's test send. Retries must never double-deliver.

**How**: BullMQ group/limiter keyed by `organizationId`. `messages.idempotencyKey` is unique on `(campaignId, guestId)`.

---

## 6. Deploy — Fly + Neon + Upstash + Vercel

**Decision**: Fly.io for api + worker. **Neon** for Postgres (plain Postgres, not Supabase). Upstash for Redis. Vercel for web. Resend or Postmark for transactional email.

**Why**:
- **Fly** matches existing Dockerfiles with zero change, runs persistent containers (needed for BullMQ worker + SSE), multi-region.
- **Neon** over Supabase: our stack is deliberately non-BaaS (Hono API + Drizzle + custom JWT). Supabase's value is the bundle (auto REST, Supabase Auth, storage, realtime) — most of which we already built or don't need. Our RLS uses `current_setting('app.current_org')`; Supabase RLS expects `auth.uid()` from Supabase Auth, which fights our JWT setup. Neon gives us branchable DBs (prod / staging / per-PR previews) and scale-to-zero pricing. Migration later is a `pg_dump` away — this isn't permanent.
- **Upstash** is BullMQ-compatible serverless Redis with per-command pricing.
- **Vercel** stays for web only — SPA-perfect. Never for api/worker (serverless time limits break SSE and long-running workers).

**How**: Migrations run as a Fly release task before traffic flips. Web drops `VITE_DEMO` and points at `api.<domain>`. Caddy stays for local dev only.

**Rejected**: Supabase (see above), Railway (less mature, single-vendor lock-in), AWS ECS (too much ops for the window).

---

## 7. Observability — logs, errors, traces on the hot path

**Decision**: Pino logs drained to Axiom or BetterStack. Sentry for errors. OpenTelemetry traces on `POST /campaigns → queue → send → webhook`.

**Why**: Small team, hosted tooling. The hot path is the one that breaks in production; instrumenting it first is the highest-leverage call.

**How**: Every log/error/trace tagged with `organization_id`. One dashboard covers queue depth, p95 send latency, error rate, and Meta 4xx/5xx.

---

## 8. Testing — critical paths, no coverage target

**Decision**: Vitest units on schemas + renderers + drivers. Integration tests against testcontainers Postgres, including an RLS negative test. One Playwright smoke (login → create campaign → see delivered).

**Why**: A 100% coverage target wastes the window. Isolation, auth, and the send pipeline are the things we cannot ship broken.

**How**: GitHub Actions runs the suite on PRs; main deploys. Target CI under 10 minutes.
