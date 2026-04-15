-- Task 8: Add idempotency to messages so retries never double-send.
-- The key is derived from (campaign_id, guest_id) for campaign messages, or
-- generated per message for test sends (where guest_id is NULL).

ALTER TABLE "messages" ADD COLUMN "idempotency_key" text;
--> statement-breakpoint

-- Back-fill existing rows: campaign_id + guest_id for normal messages; id for test sends.
UPDATE "messages"
   SET "idempotency_key" = COALESCE(
     "campaign_id"::text || ':' || "guest_id"::text,
     "id"::text
   )
 WHERE "idempotency_key" IS NULL;
--> statement-breakpoint

ALTER TABLE "messages" ALTER COLUMN "idempotency_key" SET NOT NULL;
--> statement-breakpoint

-- Unique per-org so one campaign can't send to the same guest twice.
CREATE UNIQUE INDEX IF NOT EXISTS "messages_idempotency_key_idx"
  ON "messages"("org_id", "idempotency_key");
