# Roadmap

Single source of truth for what's shipping, what's next, and what we're choosing not to build. One file. Groomed in every PR that changes scope.

See [plans/architecture-decisions.md](plans/architecture-decisions.md) for the *why* of technical choices, [features/](features/) for per-feature specs, [runbook/](runbook/) for ops.

---

## Mission

A WhatsApp-first customer-messaging SaaS: **pick an audience → prepare a message → send → track results.** Hotel is our first customer; the product is built generic (Contacts + Audiences + Campaigns + first-party Modules) so hospitality polish ships as the Check-In module, not as core bloat. Build for today's customer. Design for tomorrow's platform.

---

## Now

Actively in flight. One or two items max.

- **Cloud deploy to `reform-hotel.clientora.net`** — first real customer. MVP pool path (Hetzner + Caddy + per-project DB), not Fly. [`deploy/mvp-pool/`](../deploy/mvp-pool/), brief in [plans/deploy_requirements_and_mvp_pool_for_senior_devops.md](plans/deploy_requirements_and_mvp_pool_for_senior_devops.md). Blocker: VPS bootstrap + first `clientora mvp:add` cutover.

---

## Next

Queued, not started. Pick top-down.

- **Meta Cloud sandbox end-to-end** — 50-message smoke against real Meta API via worker + webhook + SSE. Until this runs once, "Cloud driver ready" is a claim not a fact.
- **Demo user** (magic-link or prefilled creds) — friction-free click-through for prospects.
- **Easy login** — reduce the password-at-every-step tax; shared concern across the MVP pool.
- **Tenant manager** — cross-MVP admin console for managing tenants in the shared pool.
- **RLS negative test + Playwright smoke** — the two tests explicitly called out in [plans/mvp-to-production.md](plans/mvp-to-production.md) Task 15 that we still haven't landed.
- **Onboarding funnel measurement** — instrument the signup → verified → first-campaign path in `audit_events`; make the dashboard empty state a 3-step checklist.

## Later

Append-only backlog. No estimates. Items graduate to Next when we pick them up.

- External log drain (BetterStack / Axiom) + uptime monitor on `/health/deep`
- Minimal inbound-replies surface — store inbound WA messages, show a read-only "Replies" tab per contact
- Info-bar / toast when Check-In auto-message fires ([features/modules-and-checkin.md §13](features/modules-and-checkin.md))
- Hotel PMS (Electra) webhook → auto-trigger check-in/check-out events
- UI i18n (EN + TR at least) — product UI is currently English only
- Second module: outbound campaign scheduling / delayed sends
- Template categories + template library (seed per vertical)
- Reply-inbox (conversation view, assignment, statuses) — larger scope
- Multiple WhatsApp devices per workspace
- 2FA, WAF, hardened 429 handling
- Third-party plugin runtime (explicitly deferred in modules spec)
- Licensing / plan limits
- Advanced user roles + permissions
- Dynamic audience segments / rule-based filtering

## Won't do (not now)

Ideas we considered and are *deliberately* not building — here to stop re-proposals.

- Schema-per-tenant or instance-per-tenant (chose shared Postgres + RLS — [architecture-decisions.md §1](plans/architecture-decisions.md))
- Supabase / managed BaaS (chose Neon/plain-Postgres — [architecture-decisions.md §6](plans/architecture-decisions.md))
- Separate reporting system for automated messages (unified report + `origin` tag — [features/modules-and-checkin.md §11](features/modules-and-checkin.md))
- Dynamic code loading / third-party plugins in MVP ([features/modules-and-checkin.md §3](features/modules-and-checkin.md))
- Reply-inbox in MVP ([plan-1.md §12 M4](plan-1.md), scope deferred)

---

## Recently shipped

Last ~10 in reverse order. Prune after one release cycle.

- **Clientora tenant CLI** — `clientora tenant:add` provisions isolated org + admin user
- **Modules system + Check-In auto-messaging** — first-party module pattern; `campaigns.origin` tagging for manual vs auto sends
- **Settings tabs** — General / WhatsApp / Branding / Modules grouping
- **14-day reports chart** — timezone-aware daily buckets
- **Functional Baileys driver** — Web WhatsApp path with session stability + circuit breaker
- **Phase 2 Contacts/Audiences/Tags pivot** (M1–M7) — guests → contacts, multi-audience campaigns, prototype replaced
- **WhatsApp connect wizard + encrypted tokens** — AES-256-GCM with per-org key; audit-logged
- **Self-serve signup + sample data pack** — 15 guests, 3 templates seeded on opt-in
- **Audit log** — `audit_events` table + non-throwing helper, wired into auth/campaign/settings mutations
- **CSV import hardening** — preview dialog, 5k-row cap, per-row validation, rate-limited

---

## How we work this file

- Each PR that changes scope moves one line here. CI doesn't enforce it — your own discipline does.
- `Now` has owner + started date. `Next`/`Later` don't.
- `Later` is free-form; one line per idea. When it graduates to `Next`, *then* it gets fleshed out.
- `Won't do` items stay permanently so we don't re-litigate them.
- For detail, link to a spec in [features/](features/) or [plans/](plans/); don't inline it here.
