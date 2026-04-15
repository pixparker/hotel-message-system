-- Task 2: Row-Level Security for tenant isolation.
-- App-layer org_id scoping remains line 1; RLS is line 2.
-- Policies read the current tenant from the `app.current_org` session variable.
-- The api `withTenant` middleware sets it per-request via `SET LOCAL`.
--
-- Enforcement note: PostgreSQL bypasses RLS for the table owner and superusers.
-- Locally (Compose) the `hms` user is a superuser, so RLS is effectively inert
-- — we rely on app-layer scoping in dev and prove isolation in the integration
-- suite by connecting as a non-owner role. In production (Neon), a dedicated
-- non-owner app role is provisioned at deploy time (task 9); the migrations
-- and seed continue to run as the owner. If you want RLS enforced for the
-- owner role too, add `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` — but then
-- the SECURITY DEFINER helpers below need to be rehomed to a BYPASSRLS role.

-- 1. Denormalize org_id onto messages + template_bodies so RLS policies stay trivial.
ALTER TABLE "messages" ADD COLUMN "org_id" uuid;
ALTER TABLE "template_bodies" ADD COLUMN "org_id" uuid;
--> statement-breakpoint

UPDATE "messages" m
   SET "org_id" = c."org_id"
  FROM "campaigns" c
 WHERE m."campaign_id" = c."id";
--> statement-breakpoint

UPDATE "template_bodies" tb
   SET "org_id" = t."org_id"
  FROM "templates" t
 WHERE tb."template_id" = t."id";
--> statement-breakpoint

ALTER TABLE "messages" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "template_bodies" ALTER COLUMN "org_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "template_bodies"
  ADD CONSTRAINT "template_bodies_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "messages_org_idx" ON "messages" ("org_id");
--> statement-breakpoint

-- 2. Enable RLS on every tenant table.
ALTER TABLE "organizations"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guests"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "templates"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_bodies"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings"         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 3. Policies. current_setting(..., TRUE) returns NULL if unset → no rows visible.
CREATE POLICY "tenant_isolation" ON "organizations"
  FOR ALL
  USING ("id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "users"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "guests"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "templates"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "template_bodies"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "campaigns"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "messages"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);

CREATE POLICY "tenant_isolation" ON "settings"
  FOR ALL
  USING ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid)
  WITH CHECK ("org_id" = nullif(current_setting('app.current_org', TRUE), '')::uuid);
--> statement-breakpoint

-- 4. Login needs to look a user up by email before the tenant is known.
--    SECURITY DEFINER function owned by the table owner bypasses RLS cleanly.
CREATE OR REPLACE FUNCTION auth_find_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  email text,
  password_hash text,
  role user_role,
  test_phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.test_phone
    FROM public.users u
   WHERE u.email = lower(p_email)
   LIMIT 1;
$$;
--> statement-breakpoint

-- 5. Worker jobs look up org_id for a message when re-hydrating after a retry.
CREATE OR REPLACE FUNCTION worker_org_for_message(p_message_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.messages WHERE id = p_message_id;
$$;
