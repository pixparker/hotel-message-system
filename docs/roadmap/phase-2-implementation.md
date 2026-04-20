# Phase 2 — E2E Implementation Plan

## Context

Phase 1 (UI prototype at `/prototype/*`) has been approved. Phase 2 now wires the approved UI into the real product — schema, migration, API, worker, and replaces the existing `/guests`, `/send`, `/dashboard` pages. The prototype folder (`apps/web/src/prototype/`) is removed at the end.

**Source spec**: [docs/roadmap/plan-2-product-upgrade.md](plan-2-product-upgrade.md)
**Approved prototype**: live at `/prototype/*` (visible via sidebar entry)
**User decisions already confirmed**:
- Full rename `guests` → `contacts` (hotel columns optional nullable)
- Add `source` enum + `tags` table + `audiences` tables
- Generic UI terminology; hotel fields conditional
- All MVP gaps in one iteration, but split into approvable milestones

---

## Strategy: 7 Independent Milestones

Each milestone ships a working green-build state. User approves before moving to the next. No single mega-PR.

| # | Milestone | Ships | Review gate |
|---|---|---|---|
| M1 | Data layer | migration, schema, seed, default audiences helper | migration runs cleanly, existing data preserved |
| M2 | Shared types & helpers | Zod schemas, render helpers | typecheck green across monorepo |
| M3 | Contacts API | renamed routes + CRUD + source/audience/tag handling | API smoke test via curl/Bruno |
| M4 | Audiences + Tags API | new route files, recipient-preview endpoint | API smoke test |
| M5 | Campaigns API | multi-audience selection, updated queries | send a real campaign end-to-end |
| M6 | Frontend replacement | real `/contacts`, `/audiences`, updated `/send`, dashboard, reports | click-through UI match to prototype |
| M7 | Cleanup | delete `prototype/` folder, delete old `guests.tsx`, `useGuests.ts` | grep shows no orphan references |

Worker changes are tiny (column rename propagation) and land alongside M1/M2.

---

## M1 — Data Layer

### Files
- **Modify** [packages/db/src/schema.ts](../../packages/db/src/schema.ts) — new tables, relations, enum
- **Create** [packages/db/src/defaults.ts](../../packages/db/src/defaults.ts) — `createDefaultAudiences(db, orgId)` helper
- **Create** `packages/db/migrations/0011_contacts_audiences_tags.sql` — single migration (check exact next number; may be 0011 or later)
- **Modify** [packages/db/src/seed.ts](../../packages/db/src/seed.ts) — use contacts + assign to Hotel Guests audience
- **Modify** [packages/db/src/fixtures/sample-hotel.ts](../../packages/db/src/fixtures/sample-hotel.ts) — rename symbol with alias

### Schema changes

**New enum**: `contact_source` = `('manual' | 'hotel' | 'csv' | 'future')`.

**Rename table** `guests` → `contacts`. Columns added / changed:
- add `source contact_source NOT NULL DEFAULT 'manual'`
- add `is_active boolean NOT NULL DEFAULT true`
- add `updated_at timestamptz NOT NULL DEFAULT now()`
- drop NOT NULL on `room_number`, `status`, `checked_in_at` (keep columns — hotel data for those in Hotel Guests audience)
- rename indexes `guests_*` → `contacts_*`; add `contacts_org_source_idx`, `contacts_org_active_idx`
- keep existing pg enum name `guest_status` (only rename the TS export); a rename of a pg enum is risky during partial deploys

**New tables** (all with `org_id` + `tenant_isolation` RLS policy, matching pattern of migration 0003):

```
audiences (id uuid pk, org_id fk orgs, name text, kind text default 'custom',
           description text, is_system bool default false, created_at timestamptz,
           unique (org_id, name), index (org_id))

contact_audiences (contact_id fk contacts, audience_id fk audiences, org_id fk orgs,
                   added_at timestamptz, pk (contact_id, audience_id),
                   index (audience_id), index (org_id))

tags (id uuid pk, org_id fk orgs, label text, color text, created_at timestamptz,
      unique (org_id, label), index (org_id))

contact_tags (contact_id fk contacts, tag_id fk tags, org_id fk orgs,
              pk (contact_id, tag_id), index (tag_id))

campaign_audiences (campaign_id fk campaigns, audience_id fk audiences
                    on delete set null, org_id fk orgs,
                    pk (campaign_id, audience_id), index (audience_id))
```

**Campaigns change**: make `recipient_filter` nullable (retained for future dynamic segments).

**Messages change**: rename column `guest_id` → `contact_id`, drop+recreate FK to `contacts(id)`. Update `messagesRelations.contact`.

**Relations updated**: `organizationsRelations` (contacts, audiences, tags), new `contactsRelations`, `audiencesRelations`, `tagsRelations`, `campaignsRelations.audiences`.

### Migration SQL (one transaction)
1. ALTER TABLE `guests` RENAME TO `contacts`; rename indexes.
2. Add `source`, `is_active`, `updated_at`; drop NOT NULL on hotel fields; backfill `source='hotel'`.
3. Rename `messages.guest_id` → `messages.contact_id`; drop + recreate FK.
4. CREATE TABLE for the 5 new tables; enable RLS + `tenant_isolation` policies.
5. For each existing org: insert 3 system audiences (`Hotel Guests` kind=`hotel_guests` is_system=true, `VIP` kind=`vip`, `Friends` kind=`friends`).
6. For each existing contact: insert `contact_audiences` row linking to its org's Hotel Guests.
7. Backfill `campaign_audiences` for existing campaigns → Hotel Guests of the org (best-effort).
8. ALTER `campaigns.recipient_filter` DROP NOT NULL (if not already).
9. Update `organizations.onboarding_state` to include `defaultAudiencesCreated: true`.

### Verification
- Copy dev DB: `pg_dump hms_dev > /tmp/hms_pre_phase2.sql`
- Run migration on the copy
- `SELECT count(*) FROM contacts` equals pre-migration `guests` count
- `SELECT DISTINCT source FROM contacts` returns only `hotel`
- 3 system audiences per org; every contact is member of Hotel Guests
- RLS policies present via `pg_policies`
- `pnpm --filter @hms/db typecheck` + `pnpm -w typecheck` green

---

## M2 — Shared Types & Helpers

### Files
- **Modify** [packages/shared/src/schemas.ts](../../packages/shared/src/schemas.ts) — rename + new schemas
- **Modify** [packages/shared/src/render.ts](../../packages/shared/src/render.ts) — rename symbol
- **Modify** [packages/shared/src/schemas.test.ts](../../packages/shared/src/schemas.test.ts)

### Changes
- `guestCreateSchema` → `contactCreateSchema` with new fields: `source`, `audienceIds`, `tagIds`, `isActive`. Keep `roomNumber` optional.
- `guestUpdateSchema` → `contactUpdateSchema = contactCreateSchema.partial()`.
- New: `audienceCreateSchema`, `audienceUpdateSchema`, `audienceMembershipSchema`, `tagCreateSchema`.
- `campaignCreateSchema`: replace mandatory `recipientFilter` with `audienceIds: z.array(uuid).min(1)`. Keep `recipientFilter` as optional nullable JSON.
- `renderForGuest` → `renderForContact`. Type `GuestContext` → `ContactContext`. Keep aliased re-export for one release so worker doesn't break mid-deploy:
  ```ts
  export { renderForContact as renderForGuest } from "./render.js";
  ```

### Verification
- `pnpm -w test` (shared tests) green
- `pnpm -w typecheck` green

---

## M3 — Contacts API

### Files
- **Rename** [apps/api/src/routes/guests.ts](../../apps/api/src/routes/guests.ts) → `apps/api/src/routes/contacts.ts`
- **Modify** [apps/api/src/main.ts](../../apps/api/src/main.ts) — mount at `/api/contacts`, drop `/api/guests`
- **Modify** [apps/api/src/routes/auth.ts](../../apps/api/src/routes/auth.ts) — call `createDefaultAudiences` in register; assign sample contacts on signup

### Endpoint behavior
- `GET /api/contacts` supports `?audienceId`, `?source`, `?status`, `?q`, `?isActive`
- `POST /api/contacts` body accepts `audienceIds?`, `tagIds?`, `source?` (default manual)
- `PATCH /api/contacts/:id` adds `isActive?`, `audienceIds?`, `tagIds?` (replace memberships atomically)
- Kept: `POST /:id/checkout`, `POST /:id/checkin` (hotel-specific actions)
- CSV import sets `source='csv'`; optional `?audienceId` assigns imported contacts to a chosen audience

### Worker impact (land here)
- [apps/worker/src/main.ts](../../apps/worker/src/main.ts) — rename `guestId` field refs → `contactId`. No logic change.

### Verification
- `pnpm --filter @hms/api dev` starts
- `curl -X GET /api/contacts` returns list with `source`, `isActive`
- Create a contact via POST with `audienceIds=[aud-vip]` → shows up in VIP via GET
- `pnpm -w typecheck` green

---

## M4 — Audiences + Tags API

### Files (new)
- **Create** `apps/api/src/routes/audiences.ts`
- **Create** `apps/api/src/routes/tags.ts`
- **Modify** `apps/api/src/main.ts` — mount `/api/audiences`, `/api/tags`

### Audiences routes
```
GET    /           list with memberCount
POST   /           create
PATCH  /:id        rename/describe; 409 on is_system
DELETE /:id        409 on is_system
GET    /:id/contacts      paginated members
POST   /:id/contacts      { contactIds[] } bulk add
DELETE /:id/contacts      { contactIds[] } bulk remove
```

### Tags routes
```
GET    /    list with usageCount
POST   /    create
PATCH  /:id rename/recolor
DELETE /:id
```

### Middleware
Same `requireAuth` + `withTenant` as other routes.

### Verification
- List returns 3 system audiences for a fresh org
- Create `Returning Customers` custom audience; rename; delete — all work
- Attempt to delete `Hotel Guests` → 409
- Add 3 contacts to VIP via bulk endpoint → GET shows them
- `pnpm -w typecheck` green

---

## M5 — Campaigns API

### Files
- **Modify** [apps/api/src/routes/campaigns.ts](../../apps/api/src/routes/campaigns.ts)

### Changes
- `POST /api/campaigns` body shape: `{ title, templateId?, customBodies?, audienceIds: string[] }` — `audienceIds` min 1
- Recipient resolution:
  ```sql
  SELECT DISTINCT c.*
    FROM contacts c
    JOIN contact_audiences ca ON ca.contact_id = c.id
   WHERE c.org_id = :orgId
     AND c.is_active = true
     AND ca.audience_id = ANY(:audienceIds)
  ```
- Insert `campaign_audiences` rows in same transaction as campaign creation
- Drop writes to `campaigns.recipient_filter` (leave null)
- `GET /api/campaigns/:id` response: include `audiences: [{id, name, kind}]`
- Audit log metadata: include `audienceIds` + `recipientCount`
- Preserve template-approval gate, idempotency keys

### New: `GET /api/campaigns/recipient-preview?audienceIds=...`
Returns `{ total, byLanguage: [...], sample: [5 contacts] }`. Small, indexed query for wizard step 3.

### Stats updates
- **Modify** [apps/api/src/routes/stats.ts](../../apps/api/src/routes/stats.ts)
- `GET /dashboard`: rename response field `activeGuests` → `activeContacts`. Add `byAudience: [{id, name, memberCount}]`.
- `GET /reports`: rename `uniqueGuests` → `uniqueRecipients`.

### Verification
- Create campaign with `audienceIds=[vipId, friendsId]`; `recipientCount` equals deduped union
- `GET /api/campaigns/recipient-preview?audienceIds=...` returns expected counts
- SSE live stream still emits progress events
- Send a real (mock-driver) campaign end-to-end: queued → sent → delivered → read
- `pnpm -w typecheck` green

---

## M6 — Frontend Replacement

At this point the real backend is ready. Swap prototype UI into live routes. Keep the approved prototype components — just relocate and hook up to hooks instead of mock data.

### Files

**Renames**
- [apps/web/src/routes/guests.tsx](../../apps/web/src/routes/guests.tsx) → `apps/web/src/routes/contacts.tsx` (replace body with prototype's Contacts page, pointed at real hooks)
- [apps/web/src/hooks/useGuests.ts](../../apps/web/src/hooks/useGuests.ts) → `apps/web/src/hooks/useContacts.ts` (update endpoint paths, add new filter params, add PATCH hooks for audiences/tags memberships)

**New pages**
- `apps/web/src/routes/audiences.tsx` — adapt from [apps/web/src/prototype/routes/Audiences.tsx](../../apps/web/src/prototype/routes/Audiences.tsx)
- `apps/web/src/routes/audience-detail.tsx` — adapt from [apps/web/src/prototype/routes/AudienceDetail.tsx](../../apps/web/src/prototype/routes/AudienceDetail.tsx)

**New hooks**
- `apps/web/src/hooks/useAudiences.ts` — `useAudiences`, `useAudience(id)`, `useCreateAudience`, `useRenameAudience`, `useDeleteAudience`, `useAudienceMembers(id)`, `useAddToAudience`, `useRemoveFromAudience`
- `apps/web/src/hooks/useTags.ts`
- `apps/web/src/hooks/useRecipientPreview.ts`

**Moved components** (out of `prototype/`, into `components/`)
- `SourceBadge.tsx`, `AudienceChip.tsx`, `TagChip.tsx`, `AudienceMultiSelect.tsx`, `RecipientPreviewCard.tsx`

**Modified**
- [apps/web/src/App.tsx](../../apps/web/src/App.tsx) — route `/guests` → `/contacts`; add `/audiences`, `/audiences/:id`
- [apps/web/src/components/AppShell.tsx](../../apps/web/src/components/AppShell.tsx) — nav "Guests" → "Contacts"; add "Audiences"; remove prototype banner link
- [apps/web/src/state/wizard.ts](../../apps/web/src/state/wizard.ts) — replace `recipientStatus` with `selectedAudienceIds: string[]`; bump persistence key to `hms-wizard-v2`
- [apps/web/src/routes/send/step-3-recipients.tsx](../../apps/web/src/routes/send/step-3-recipients.tsx) — replace with audience multi-select + recipient preview
- [apps/web/src/routes/send/step-4-test.tsx](../../apps/web/src/routes/send/step-4-test.tsx) — already works; small copy tweak (recipients label)
- [apps/web/src/routes/send/step-5-confirm.tsx](../../apps/web/src/routes/send/step-5-confirm.tsx) — POST body uses `audienceIds`; summary shows audience chips
- [apps/web/src/routes/dashboard.tsx](../../apps/web/src/routes/dashboard.tsx) — "Active Contacts" tile, "Top Audiences" card; Currently-in-house section conditional on Hotel Guests audience count > 0
- [apps/web/src/routes/reports.tsx](../../apps/web/src/routes/reports.tsx) — "Unique recipients" label
- [apps/web/src/routes/campaign-detail.tsx](../../apps/web/src/routes/campaign-detail.tsx) + [live.tsx](../../apps/web/src/routes/live.tsx) — show "Sent to:" audience chips
- [apps/web/src/components/CsvImportDialog.tsx](../../apps/web/src/components/CsvImportDialog.tsx) — add audience target dropdown

### Hotel-terminology conditional rule
- Nav / page titles / toolbar buttons: generic ("Contacts", "Add contact")
- Hotel fields (Room #, Check-in / Check-out buttons, "Currently in-house"): only visible when filter audience is Hotel Guests OR on a contact known to be in the Hotel Guests audience

### Verification
- Click through `/contacts`, `/audiences`, `/audiences/:id`, `/send` wizard (all 5 steps), `/campaigns/:id`
- Run a real campaign to VIP + Friends; check live + detail pages show audience chips
- Compare UI side-by-side with `/prototype/*` — behavior should match
- `pnpm -w typecheck`, `pnpm -w test` green
- Browser console: no errors

---

## M7 — Cleanup

### Files
- **Delete** [apps/web/src/prototype/](../../apps/web/src/prototype/) (entire folder)
- **Modify** [apps/web/src/App.tsx](../../apps/web/src/App.tsx) — remove `/prototype/*` route + import
- **Modify** [apps/web/src/components/AppShell.tsx](../../apps/web/src/components/AppShell.tsx) — remove "Prototype preview" footer link + `Eye` import

### Grep safety checks
- `grep -r "\bguests\b" apps/ packages/ | grep -v node_modules` — review hits (some may be intentional hotel wording in English strings; that's fine)
- `grep -r "guestId" apps/ packages/` — should return empty
- `grep -r "useGuests" apps/web/src/` — should return empty
- `grep -r "renderForGuest" apps/` — should return empty (or only the aliased re-export in shared)
- `grep -r "prototype" apps/web/src/` — should return empty

### Optional follow-up (not blocking)
- Drop the aliased `renderForGuest` re-export in `@hms/shared` after one release cycle
- Add audience filter to existing CSV import flow UI (already wired server-side in M3)

### Verification
- `pnpm -w typecheck`, `pnpm -w test`, `pnpm --filter @hms/web build` all green
- App runs; full click-through of all routes works
- Final commit message refers to the issue/spec

---

## Risks & Watch-Outs

| Risk | Mitigation |
|---|---|
| Partial deploy where worker is still at old schema when API deploys new | Wrap migration + restart in a maintenance window; both app + worker are re-deployed together |
| RLS policy regression on new tables | Copy the exact policy block from migration 0003; verify via `pg_policies` |
| Persisted wizard state (old `recipientStatus`) breaks on load | Bump persistence key to `hms-wizard-v2` (users just lose one in-progress wizard — acceptable) |
| Historical campaigns losing meaningful "sent-to" attribution | Backfill to Hotel Guests in M1 step 7 — approximation, noted in migration comment |
| Data migration failure on larger customer dataset | Dev DB is tiny; run on staging/copy first, measure duration |
| Worker deploy mismatch on `guestId` rename | Alias re-export `renderForGuest` from shared so mid-deploy worker still compiles |

---

## Out of Scope (stays deferred)

- Dynamic audience segments / rule-based filtering (spec §5.3 future)
- Multiple WhatsApp connections (spec §5.6 future)
- Automation / workflow engine
- Full Electra integration (placeholder only — architecture ready via `source='hotel'`)
- Inbound reply inbox
- Multi-tenant plan / licensing layer
- Advanced user roles

---

## Recommended Execution Order

1. Start M1 together in one branch; PR.
2. User reviews migration + runs it locally; approves.
3. M2 PR (fast — just types).
4. M3 + worker rename PR.
5. M4 PR.
6. M5 PR — user tests a real send.
7. M6 PR — visual review against prototype.
8. M7 cleanup PR.

Each milestone is a single PR. Tests and typecheck must stay green between milestones so the branch stays deployable.
