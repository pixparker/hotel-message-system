-- Task 14: Audit log for security-relevant events.
-- One row per auditable action: login, signup, password reset, campaign
-- create/send, settings change, guest import/export, user invite, etc.
-- Queryable per-tenant; admin can answer "who did X?".

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,  -- NULL for pre-tenant events (e.g. failed login by unknown email)
  "user_id" uuid,
  "action" text NOT NULL,
  "target" text,                        -- resource id (campaign uuid, user uuid, etc.)
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "audit_events_org_id_fk" FOREIGN KEY ("org_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "audit_events_user_id_fk" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_events_org_created_idx"
  ON "audit_events"("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events"("action");
--> statement-breakpoint

-- RLS on audit_events so tenants can only see their own events.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "audit_events"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);
--> statement-breakpoint

-- SECURITY DEFINER helper: write audit events from pre-tenant contexts
-- (failed login, registration) without needing app.current_org set.
CREATE OR REPLACE FUNCTION audit_log_event(
  p_org_id uuid,
  p_user_id uuid,
  p_action text,
  p_target text,
  p_metadata jsonb,
  p_ip text,
  p_user_agent text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_events(org_id, user_id, action, target, metadata, ip, user_agent)
    VALUES (p_org_id, p_user_id, p_action, p_target, COALESCE(p_metadata, '{}'::jsonb), p_ip, p_user_agent);
$$;
