-- WhatsApp Baileys (unofficial / WhatsApp Web) driver support.
--
-- Each tenant that opts into provider=baileys gets a long-lived socket in the
-- worker. Baileys needs a Signal key store that survives restarts: a creds
-- blob + a row per (key_type, key_id). Storing this in settings.waConfig would
-- mean rewriting a multi-MB JSONB on every key rotation, so it gets its own
-- row-oriented tables.
--
-- Tokens (creds and key values) are encrypted at rest with SECRETS_ENCRYPTION_KEY
-- before being written; see apps/worker/src/crypto.ts encryptBytes.

CREATE TABLE "wa_baileys_sessions" (
  "org_id"              uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "creds"               bytea,
  "status"              text NOT NULL DEFAULT 'pending',  -- pending | connected | logged_out | failed
  "phone_e164"          text,
  "connected_at"        timestamptz,
  "throttle_mode"       text NOT NULL DEFAULT 'careful',  -- careful | balanced | custom
  "custom_rate_per_min" integer,                          -- when throttle_mode='custom'
  "daily_cap"           integer NOT NULL DEFAULT 500,
  "cold_policy"         text NOT NULL DEFAULT 'warn',     -- warn | block | allow
  "acknowledged_at"     timestamptz,
  "banned_suspected_at" timestamptz,
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "wa_baileys_keys" (
  "org_id"     uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "key_type"   text NOT NULL,
  "key_id"     text NOT NULL,
  "value"      bytea NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("org_id", "key_type", "key_id")
);
CREATE INDEX "wa_baileys_keys_org_type_idx"
  ON "wa_baileys_keys" ("org_id", "key_type");
--> statement-breakpoint

-- RLS: same pattern as migration 0003. The worker opens sockets before the
-- tenant context is set on its db connection, so we also expose a
-- SECURITY DEFINER helper for the initial session load.
ALTER TABLE "wa_baileys_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wa_baileys_keys"     ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation" ON "wa_baileys_sessions"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "wa_baileys_keys"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);
--> statement-breakpoint

-- Worker boot loads a session without yet knowing which tenant owns it (it
-- iterates all connected orgs). This function returns the session row bypassing
-- RLS; callers then pin the tenant context for all subsequent per-key reads.
CREATE OR REPLACE FUNCTION baileys_load_session(p_org_id uuid)
RETURNS TABLE (
  org_id              uuid,
  creds               bytea,
  status              text,
  phone_e164          text,
  connected_at        timestamptz,
  throttle_mode       text,
  custom_rate_per_min integer,
  daily_cap           integer,
  cold_policy         text,
  acknowledged_at     timestamptz,
  banned_suspected_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id, creds, status, phone_e164, connected_at,
         throttle_mode, custom_rate_per_min, daily_cap, cold_policy,
         acknowledged_at, banned_suspected_at
    FROM public.wa_baileys_sessions
   WHERE org_id = p_org_id;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION baileys_list_connected_orgs()
RETURNS TABLE (org_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.wa_baileys_sessions
   WHERE status = 'connected' AND creds IS NOT NULL;
$$;
