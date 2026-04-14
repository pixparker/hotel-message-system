# Hotel Guest Messaging System — Architecture Plan

## Context

Greenfield system (the repo contains only [docs/ui-specification.md](/Users/pixparker/repo/mvp/hotel-message-system/docs/ui-specification.md)). The product is a web app that lets hotel reception staff send WhatsApp messages to current guests in under 30 seconds, with a guided wizard (template → multi-language → recipients → test → send → live status → reports).

Three non-negotiable constraints drive the architecture:

1. **Web-based** — staff use it from any browser at the front desk.
2. **On-premises deployable** — a single hotel should be able to install and run it inside its own network without cloud dependencies. This rules out managed-only services and forces a containerized, self-contained bundle.
3. **Professional business product, not a toy demo** — the UI, copy, empty states, error handling, audit trail, and install experience must all read as a commercial SaaS that happens to also ship on-prem. "Demo-ready" is a property of M1, not the ceiling of the product.

Everything else (WhatsApp integration choice, multi-tenancy, framework granularity) is a judgment call covered below.

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (staff laptop / tablet in hotel LAN)               │
│  React SPA — wizard, dashboard, live status via SSE         │
└───────────────▲────────────────────────────▲────────────────┘
                │ HTTPS (REST + SSE)         │
┌───────────────┴────────────────────────────┴────────────────┐
│  Caddy / Nginx reverse proxy (TLS, static SPA, /api, /sse)  │
└───────────────▲────────────────────────────▲────────────────┘
                │                            │
        ┌───────┴──────┐            ┌────────┴────────┐
        │  API server  │            │  Worker         │
        │  (Hono+TS)   │◀─ BullMQ ─▶│  (BullMQ)       │
        │  REST + SSE  │   jobs     │  renders +      │
        │  auth, CRUD  │            │  sends via GW   │
        └───┬───────┬──┘            └────────┬────────┘
            │       │                        │
            │       │                        ▼
            │       │              ┌──────────────────┐
            │       │              │ WhatsApp Gateway │
            │       │              │ (pluggable):     │
            │       │              │  • Cloud API     │
            │       │              │  • Baileys (LAN) │
            │       │              └────────┬─────────┘
            │       │                       │ delivery/read
            │       │                       │ callbacks
            │       ▼                       ▼
            │   ┌──────────┐       ┌──────────────────┐
            │   │  Redis   │       │ webhook receiver │
            │   │ queue+   │◀──────┤ (part of API)    │
            │   │ pub/sub  │       └──────────────────┘
            │   └──────────┘
            ▼
        ┌──────────────┐
        │ PostgreSQL   │  guests, templates, campaigns,
        │              │  messages, users, settings
        └──────────────┘
```

Every box above runs as a container in one `docker-compose.yml`. An on-prem install is `git clone && docker compose up -d`.

---

## 2. Technology choices (matches existing user conventions)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Same pattern as [asset-flow-yaser](/Users/pixparker/repo/mvp/asset-flow-yaser); fast, lightweight |
| Frontend | **React 19 + Vite + TypeScript** | User convention |
| UI | **Tailwind CSS + Lucide icons + Radix primitives** | Matches asset-flow-yaser; premium look with low ceremony. Mantine is the alternative if staff need rich tables. |
| Data fetching | **TanStack Query** | Cache + live invalidation |
| Forms | **react-hook-form + zod** | Shared zod schemas with backend |
| Backend | **Hono on Node.js 20** | Matches asset-flow-yaser. Small, fast, easy to containerize. NestJS is overkill for this domain. |
| ORM | **Drizzle ORM + drizzle-kit migrations** | Matches asset-flow-yaser; type-safe, migration files in git — critical for on-prem installs |
| DB | **PostgreSQL 16** | User convention |
| Queue | **BullMQ on Redis 7** | Matches airport-ai; needed for background send + retries |
| Realtime | **Server-Sent Events (SSE)** over Redis pub/sub | Simpler than WebSockets, proxy-friendly, enough for "sent/delivered/seen" counters |
| Auth | **JWT (access + refresh) with bcrypt** | Matches user convention. Single-org MVP — no SSO yet. |
| WhatsApp | **Pluggable driver**: `cloud` (Meta Business Cloud API) or `baileys` (WhatsApp Web protocol, on-prem) | See §5 |
| i18n | **i18next** on frontend; template translations stored in DB | Supports EN/TR/FA/AR out of the box |
| Deployment | **Docker Compose** + Caddy for TLS | One-command on-prem install |
| Observability | **pino** structured logs + optional Grafana/Loki container (off by default) | Keeps on-prem minimal |

---

## 3. Repository layout

```
hotel-message-system/
├── apps/
│   ├── web/              # React SPA (Vite)
│   ├── api/              # Hono REST + SSE + webhook receiver
│   ├── worker/           # BullMQ worker: renders + dispatches messages
│   └── wa-gateway/       # WhatsApp driver host (Baileys session OR Cloud API client)
├── packages/
│   ├── db/               # Drizzle schema, migrations, seed
│   ├── shared/           # zod schemas, types, template renderer
│   └── wa-driver/        # Driver interface + cloud/baileys implementations
├── deploy/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env.example
└── docs/
    └── ui-specification.md
```

---

## 4. Data model (Drizzle — [packages/db/src/schema.ts](packages/db/src/schema.ts))

```
organizations     id, name, created_at                        # single row on-prem; allows SaaS later
users             id, org_id, email, password_hash, role, test_phone, created_at
guests            id, org_id, name, phone_e164, language, status(checked_in|checked_out),
                  checked_in_at, checked_out_at, created_at
templates         id, org_id, name, created_at
template_bodies   id, template_id, language, body            # one row per language
campaigns         id, org_id, created_by, title, template_id|null, custom_bodies jsonb|null,
                  recipient_filter jsonb, status(draft|sending|done|cancelled),
                  totals_sent, totals_delivered, totals_seen, totals_replies,
                  created_at, started_at, finished_at
messages          id, campaign_id, guest_id, phone_e164, language, rendered_body,
                  provider_message_id, status(queued|sent|delivered|read|failed),
                  error, sent_at, delivered_at, read_at
settings          org_id PK, wa_provider(cloud|baileys), wa_config jsonb, test_phone
webhook_events    id, provider, payload jsonb, received_at   # raw audit trail
```

Key invariants:
- `phone_e164` always stored in E.164; `libphonenumber-js` normalizes on write.
- `messages` is the single source of truth for per-recipient status; `campaigns.totals_*` are denormalized counters updated by the worker.
- `org_id` is on every row even though on-prem has one org — makes the later SaaS pivot a config switch, not a migration.

---

## 5. WhatsApp integration (the critical decision)

Meta discontinued the **on-premises WhatsApp Business API** in October 2025. That leaves two realistic paths:

**Option A — Cloud API (Meta-hosted).** Official, ToS-safe, supports templates, delivery/read receipts via webhooks. Requires: Meta Business verification, a phone number, internet access from the hotel. Best for production.

**Option B — Baileys / whatsapp-web.js (unofficial).** Drives WhatsApp Web protocol via a local session (QR-code pairing). Fully on-prem, no Meta approval. Downsides: against WhatsApp ToS (ban risk), no official templates, session needs occasional re-pair.

**Recommendation: ship both behind one driver interface.**

```ts
// packages/wa-driver/src/driver.ts
export interface WaDriver {
  sendText(to: string, body: string): Promise<{ providerMessageId: string }>;
  onStatus(cb: (e: StatusEvent) => void): void;   // delivered/read
  onInbound(cb: (e: InboundMessage) => void): void; // replies
}
```

`apps/wa-gateway` picks `cloud` or `baileys` from `SETTINGS.wa_provider` at boot. SaaS deployments default to `cloud`; hotels that can't do Meta verification flip to `baileys`. The rest of the system (worker, API, UI) never knows which is active.

---

## 6. Send-message flow (end-to-end)

1. **UI wizard** (`apps/web`) collects: template + language bodies + recipient filter + optional test phone. POSTs to `/api/campaigns` (draft).
2. **API** validates with zod, inserts `campaigns` row + one `messages` row per recipient (status=`queued`), enqueues one BullMQ job per message on `send-message` queue, returns `campaign_id`.
3. UI navigates to `/campaigns/:id/live` and opens an SSE stream `/api/campaigns/:id/events`.
4. **Worker** pulls jobs, renders body for the guest's language (fallback to org default), calls `WaDriver.sendText`, updates `messages.status=sent`, publishes `{type:'sent', campaignId, counts}` on Redis pub/sub channel `campaign:{id}`.
5. **API** SSE handler subscribes to that channel and forwards events to the browser. UI updates counters live.
6. **Webhook receiver** (`/api/webhooks/whatsapp`, or Baileys event bridge) receives delivery/read callbacks, updates `messages.status`, publishes pub/sub event, updates `campaigns.totals_*`.
7. When every `messages` row is terminal, worker sets `campaigns.status=done`. UI can close mid-send — counters are persistent, user returns via Reports.

**Test send** (wizard step 4) uses the same path but creates a one-message "test campaign" flagged `is_test=true` so it doesn't pollute reports.

---

## 7. Core API surface (Hono routers)

```
POST   /api/auth/login                 → {accessToken, refreshToken}
POST   /api/auth/refresh
GET    /api/me

GET    /api/guests?status=checked_in
POST   /api/guests                     # check-in (name, phone, language)
PATCH  /api/guests/:id
POST   /api/guests/:id/checkout

GET    /api/templates
POST   /api/templates
GET    /api/templates/:id

POST   /api/campaigns                  # create + enqueue
GET    /api/campaigns
GET    /api/campaigns/:id
GET    /api/campaigns/:id/events       # SSE
POST   /api/campaigns/:id/cancel

POST   /api/test-message               # one-off test send

POST   /api/webhooks/whatsapp          # delivery/read callbacks (Cloud API)

GET    /api/settings
PATCH  /api/settings                   # wa_provider, wa_config, default test phone
```

All non-auth routes require JWT; rate-limited with `hono-rate-limiter`; audit-logged with pino.

---

## 8. Frontend structure ([apps/web/src/](apps/web/src/))

```
src/
├── routes/
│   ├── login.tsx
│   ├── dashboard.tsx
│   ├── guests/           # table + check-in modal
│   ├── send/             # 6-step wizard (one component per step)
│   │   ├── step-1-template.tsx
│   │   ├── step-2-languages.tsx
│   │   ├── step-3-recipients.tsx
│   │   ├── step-4-test.tsx
│   │   ├── step-5-confirm.tsx
│   │   └── step-6-live.tsx
│   └── reports/
├── components/           # Button, Modal, Stepper, LanguageTabs, LiveCounters
├── hooks/
│   ├── use-campaign-stream.ts   # SSE subscription
│   └── use-guests.ts
├── lib/
│   ├── api-client.ts
│   ├── phone.ts                 # libphonenumber-js wrappers
│   └── i18n.ts
└── state/                       # zustand for wizard draft only
```

Wizard draft lives in zustand + localStorage so a page reload mid-wizard doesn't lose work. Everything else goes through TanStack Query for cache consistency.

---

## 9. On-premises deployment

Single file: [deploy/docker-compose.yml](deploy/docker-compose.yml).

```yaml
services:
  caddy:       # TLS + static SPA + /api reverse proxy
  web:         # built SPA served by caddy (copied from build stage)
  api:         # Hono
  worker:      # BullMQ consumer
  wa-gateway:  # Baileys session holder OR Cloud API adapter
  postgres:    # volume: pgdata
  redis:       # volume: redisdata
```

Install story for a hotel IT admin:

1. Copy `deploy/` to server, edit `.env` (DB password, domain, WhatsApp provider).
2. `docker compose up -d`.
3. Open `https://msg.hotel.local`, set admin password on first run.
4. If `wa_provider=baileys`: pair the WhatsApp number by scanning a QR from `/settings/whatsapp` once. Session persists in a Docker volume.
5. If `wa_provider=cloud`: paste Meta access token + phone number ID; system auto-registers the webhook URL with Meta.

Backup = `pg_dump` + snapshotting the Baileys session volume. Documented in `docs/ops.md` (not in scope for this plan).

---

## 10. Product polish baseline (applies to every screen in M1)

Non-negotiable quality bar so the system reads as a commercial product:

- **Brand system**: one tokens file ([apps/web/src/styles/tokens.css](apps/web/src/styles/tokens.css)) for color, spacing, radius, shadow, type scale. No ad-hoc Tailwind values in components.
- **Every view has four states**: loading (skeletons, not spinners), empty (illustrated + CTA), error (recoverable message + retry), success. No "blank white screen while it loads".
- **Forms**: inline zod validation, disabled-until-valid submit, clear success/failure toasts, Enter-to-submit, Esc-to-close.
- **Wizard**: stepper with completed/current/upcoming states, back navigation preserves data, browser refresh preserves draft (zustand + localStorage), "unsaved changes" guard on navigation away.
- **Live status screen**: real animated counters, per-recipient expandable list, copy-to-clipboard on message IDs, ETA estimate.
- **Reports**: filterable/sortable table, date range, CSV export, campaign detail with delivery funnel chart.
- **Branding**: product name + hotel logo slot on login and header (configurable via settings so the same build white-labels).
- **Microcopy**: real hotel-staff voice, not "Lorem" or placeholder. Error messages name the next action ("Phone number looks invalid — use format +90 555 123 45 67").
- **Keyboard + a11y**: focus rings, ARIA labels, tab order reviewed, contrast AA.
- **i18n**: the admin UI itself is translatable (not just outbound messages) — EN + TR shipped in M1.
- **Install polish**: first-run wizard (set admin password, paste logo, choose WA provider) rather than editing YAML.

## 11. Security considerations

- Passwords: bcrypt, cost 12; refresh tokens rotated.
- All guest PII (name, phone) encrypted at rest via Postgres-level TDE is out of scope; rely on disk encryption on the host (documented).
- Test-send guard: staff can only test to their own saved test phone to prevent accidental sends.
- Campaign cancel: sets a Redis flag the worker checks before each send; in-flight jobs finish, the rest drain as cancelled.
- Rate limiting on `/api/campaigns` creation and login.
- CSP + HttpOnly cookies for refresh token; access token in memory only.

---

## 12. Phased delivery

| Phase | Scope | Demo-ready? |
|---|---|---|
| **M1 — Demo skeleton** (1–2 wk) | Login, dashboard, guests CRUD + check-in/out, template CRUD, wizard UI with mocked WA driver, Reports read-only, SSE live counters driven by a fake sender | ✅ Hits the 2-minute demo flow in §Demo Flow of the spec |
| **M2 — Real WhatsApp** (1–2 wk) | Cloud API driver, webhook receiver, retries, dead-letter queue | Production-grade for Meta-verified hotels |
| **M3 — On-prem path** (1 wk) | Baileys driver, QR pairing UI, docker-compose bundle, install docs | Ships to hotels that can't do Meta verification |
| **M4 — Hardening** | Cancel/pause, audit log UI, reply inbox, template versioning, multi-tenant toggle | Optional for MVP |

M1 is demo-capable but built to production quality: every screen has real empty/loading/error states, form validation, keyboard shortcuts, accessible focus states, consistent spacing/typography tokens, and a branded login. The mock driver is swapped via config — none of the UI, API, or data model is throwaway. A hotel owner watching the 2-minute flow should feel they are looking at a shipping product, and an IT admin reviewing it afterwards should find production hygiene (migrations, health checks, audit logs, structured errors) already in place.

Seed data ([packages/db/src/seed.ts](packages/db/src/seed.ts)) uses an international guest mix and realistic EN/TR/FA templates so the demo never shows lorem-ipsum.

---

## 13. Files to create first (M1 order)

1. [package.json](package.json), [pnpm-workspace.yaml](pnpm-workspace.yaml), [turbo.json](turbo.json)
2. [packages/db/src/schema.ts](packages/db/src/schema.ts), [packages/db/src/seed.ts](packages/db/src/seed.ts)
3. [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts) (zod: guest, template, campaign)
4. [packages/wa-driver/src/driver.ts](packages/wa-driver/src/driver.ts) + [mock.ts](packages/wa-driver/src/mock.ts)
5. [apps/api/src/main.ts](apps/api/src/main.ts), routers/*, sse.ts
6. [apps/worker/src/main.ts](apps/worker/src/main.ts)
7. [apps/web/src/](apps/web/src/) — routes + wizard
8. [deploy/docker-compose.yml](deploy/docker-compose.yml), [deploy/Caddyfile](deploy/Caddyfile)

---

## 14. Verification

- **Unit**: vitest on zod schemas, template renderer, phone normalization, driver mock.
- **Integration**: spin up postgres+redis via Testcontainers; API test POSTs a campaign, asserts messages inserted and job enqueued.
- **E2E demo**: Playwright script that runs the full §Demo Flow (login → check-in → wizard → live status → reports) against the mock driver. This doubles as the CI smoke test.
- **On-prem smoke**: `docker compose up` on a clean VM, run the Playwright demo against it.

---

## Locked decisions

1. **M1 WhatsApp driver**: mock only. Cloud API in M2, Baileys in M3.
2. **Tenancy**: single-org on-prem, `org_id` present on every row for future SaaS pivot without migration.
3. **Backend**: Hono + Drizzle.
4. **UI**: Tailwind + Radix primitives + Lucide icons.
