-- Fix: auth_find_user_by_email never returned email_verified, so the JWT
-- emailVerified claim was always undefined → false, and any route behind
-- requireVerified 403'd. Add the column to the function's return shape.
-- Return-type change requires DROP+CREATE (CREATE OR REPLACE can't widen it).

DROP FUNCTION IF EXISTS auth_find_user_by_email(text);
--> statement-breakpoint

CREATE FUNCTION auth_find_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  email text,
  password_hash text,
  role user_role,
  test_phone text,
  email_verified boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.org_id, u.email, u.password_hash, u.role, u.test_phone, u.email_verified
    FROM public.users u
   WHERE u.email = lower(p_email)
   LIMIT 1;
$$;
