-- Task 4: Webhook signature verification.
-- Extends webhook_events to track rejection outcomes (per-tenant routing,
-- bad signatures, unknown phone numbers) for security auditing.
-- Also adds a SECURITY DEFINER lookup so the public webhook handler can
-- find a tenant's app secret without first knowing the tenant context.

-- 1. Add per-tenant + rejection tracking columns to webhook_events
ALTER TABLE "webhook_events" ADD COLUMN "org_id" uuid;
ALTER TABLE "webhook_events" ADD COLUMN "rejected" boolean NOT NULL DEFAULT false;
ALTER TABLE "webhook_events" ADD COLUMN "rejection_reason" text;
--> statement-breakpoint

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_org_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_events_org_idx" ON "webhook_events"("org_id");
CREATE INDEX IF NOT EXISTS "webhook_events_rejected_idx" ON "webhook_events"("rejected") WHERE "rejected";
--> statement-breakpoint

-- 2. SECURITY DEFINER lookup: webhook handler is publicly accessible and has
-- no tenant context. Returns the org and the app secret needed to verify the
-- HMAC signature on the incoming payload.
CREATE OR REPLACE FUNCTION webhook_find_settings_by_phone_number_id(p_phone_number_id text)
RETURNS TABLE (org_id uuid, app_secret text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.org_id, (s.wa_config ->> 'appSecret') AS app_secret
    FROM public.settings s
   WHERE s.wa_config ->> 'phoneNumberId' = p_phone_number_id
   LIMIT 1;
$$;
