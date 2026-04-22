-- Narrow inbound-message capture used only to power the campaign pre-flight
-- safety check ("has this recipient messaged us before?"). We deliberately do
-- NOT persist message bodies — only timestamps of who has reached out. The
-- full inbox is out of scope for the WhatsApp MVP.

CREATE TABLE "wa_inbound_touches" (
  "org_id"    uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "from_e164" text NOT NULL,
  "first_at"  timestamptz NOT NULL DEFAULT now(),
  "last_at"   timestamptz NOT NULL DEFAULT now(),
  "count"     integer NOT NULL DEFAULT 1,
  PRIMARY KEY ("org_id", "from_e164")
);
CREATE INDEX "wa_inbound_touches_org_last_idx"
  ON "wa_inbound_touches" ("org_id", "last_at" DESC);
--> statement-breakpoint

ALTER TABLE "wa_inbound_touches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "wa_inbound_touches"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);
