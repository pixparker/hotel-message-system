-- Phase 2 / M1: rename guests → contacts, introduce audiences + tags, wire
-- campaign targeting through a many-to-many junction. All existing data is
-- preserved: old guests become contacts with source='hotel' and are assigned
-- to the system "Hotel Guests" audience for their org.
--
-- Notes:
--   * The pg enum type "guest_status" is intentionally NOT renamed — renaming
--     a pg enum mid-deploy is risky if an old app container is still attached.
--     Only the TS export name changed (guestStatus → contactStatus).
--   * Hotel-specific columns (room_number, status, checked_in_at) are kept
--     but made NULLABLE so generic contacts (friends, VIPs) don't need them.

-- 1. Rename the table + indexes. Primary key, FKs, and RLS policies follow
--    the table automatically in PostgreSQL (they reference by OID).
ALTER TABLE "guests" RENAME TO "contacts";
--> statement-breakpoint

ALTER INDEX "guests_org_status_idx" RENAME TO "contacts_org_status_idx";
ALTER INDEX "guests_org_phone_idx" RENAME TO "contacts_org_phone_idx";
--> statement-breakpoint

-- 2. Rename the linking column on messages.
ALTER TABLE "messages" RENAME COLUMN "guest_id" TO "contact_id";
ALTER TABLE "messages" RENAME CONSTRAINT "messages_guest_id_guests_id_fk"
  TO "messages_contact_id_contacts_id_fk";
--> statement-breakpoint

-- 3. Add new columns to contacts.
CREATE TYPE "contact_source" AS ENUM ('manual', 'hotel', 'csv', 'future');
--> statement-breakpoint

ALTER TABLE "contacts"
  ADD COLUMN "source" "contact_source" NOT NULL DEFAULT 'manual',
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT true,
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

-- Existing rows came from the hotel flow — label them accordingly.
UPDATE "contacts" SET "source" = 'hotel';
--> statement-breakpoint

-- 4. Relax the hotel-specific constraints so a generic contact is valid.
ALTER TABLE "contacts"
  ALTER COLUMN "status" DROP NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "checked_in_at" DROP NOT NULL,
  ALTER COLUMN "checked_in_at" DROP DEFAULT;
--> statement-breakpoint

CREATE INDEX "contacts_org_source_idx" ON "contacts" ("org_id", "source");
CREATE INDEX "contacts_org_active_idx" ON "contacts" ("org_id", "is_active");
--> statement-breakpoint

-- 5. Campaigns: recipient_filter becomes optional; audience-based targeting
--    takes over via the new junction.
ALTER TABLE "campaigns" ALTER COLUMN "recipient_filter" DROP NOT NULL;
--> statement-breakpoint

-- 6. Audiences.
CREATE TABLE "audiences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'custom',
  "description" text,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "audiences_org_idx" ON "audiences" ("org_id");
CREATE UNIQUE INDEX "audiences_org_name_unq" ON "audiences" ("org_id", "name");
--> statement-breakpoint

-- 7. Contact ↔ audience membership.
CREATE TABLE "contact_audiences" (
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "audience_id" uuid NOT NULL REFERENCES "audiences"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("contact_id", "audience_id")
);
CREATE INDEX "contact_audiences_audience_idx" ON "contact_audiences" ("audience_id");
CREATE INDEX "contact_audiences_org_idx" ON "contact_audiences" ("org_id");
--> statement-breakpoint

-- 8. Tags + junction.
CREATE TABLE "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "color" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "tags_org_idx" ON "tags" ("org_id");
CREATE UNIQUE INDEX "tags_org_label_unq" ON "tags" ("org_id", "label");
--> statement-breakpoint

CREATE TABLE "contact_tags" (
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("contact_id", "tag_id")
);
CREATE INDEX "contact_tags_tag_idx" ON "contact_tags" ("tag_id");
--> statement-breakpoint

-- 9. Campaign ↔ audience snapshot. ON DELETE SET NULL on audience_id so a
--    campaign can survive an audience being deleted later.
CREATE TABLE "campaign_audiences" (
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "audience_id" uuid REFERENCES "audiences"("id") ON DELETE SET NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("campaign_id", "audience_id")
);
CREATE INDEX "campaign_audiences_audience_idx" ON "campaign_audiences" ("audience_id");
--> statement-breakpoint

-- 10. RLS: same pattern as migration 0003.
ALTER TABLE "audiences"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_audiences"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_tags"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_audiences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation" ON "audiences"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "contact_audiences"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "tags"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "contact_tags"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "campaign_audiences"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);
--> statement-breakpoint

-- 11. Seed the 3 system audiences for every existing org.
INSERT INTO "audiences" ("org_id", "name", "kind", "description", "is_system")
SELECT o."id", 'Hotel Guests', 'hotel_guests',
       'Guests currently or recently staying at the hotel.', true
  FROM "organizations" o;

INSERT INTO "audiences" ("org_id", "name", "kind", "description", "is_system")
SELECT o."id", 'VIP', 'vip',
       'High-priority contacts for special campaigns.', true
  FROM "organizations" o;

INSERT INTO "audiences" ("org_id", "name", "kind", "description", "is_system")
SELECT o."id", 'Friends', 'friends',
       'Personal network and friends of the business.', true
  FROM "organizations" o;
--> statement-breakpoint

-- 12. Every existing contact was a hotel guest — put them in the Hotel
--     Guests audience for their org.
INSERT INTO "contact_audiences" ("contact_id", "audience_id", "org_id")
SELECT c."id", a."id", c."org_id"
  FROM "contacts" c
  JOIN "audiences" a
    ON a."org_id" = c."org_id"
   AND a."kind" = 'hotel_guests'
   AND a."is_system" = true;
--> statement-breakpoint

-- 13. Best-effort attribution for historical campaigns: link each to the
--     Hotel Guests audience of its org so reports still show "Sent to".
INSERT INTO "campaign_audiences" ("campaign_id", "audience_id", "org_id")
SELECT c."id", a."id", c."org_id"
  FROM "campaigns" c
  JOIN "audiences" a
    ON a."org_id" = c."org_id"
   AND a."kind" = 'hotel_guests'
   AND a."is_system" = true;
--> statement-breakpoint

-- 14. Onboarding checklist flag.
UPDATE "organizations"
   SET "onboarding_state" =
       "onboarding_state" || '{"defaultAudiencesCreated": true}'::jsonb;
