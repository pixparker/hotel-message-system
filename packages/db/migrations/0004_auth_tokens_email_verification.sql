-- Task 3: Refresh tokens, email verification, and password reset infrastructure.
-- This migration adds stateful refresh token management with rotation and reuse detection,
-- plus email verification and password reset token tables.

-- 1. Add email_verified column to users (default false; back-fill existing to true for demo)
ALTER TABLE "users" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

UPDATE "users" SET "email_verified" = true;
--> statement-breakpoint

-- 2. Refresh tokens: stateful JWTs tracked by jti (JWT ID claim)
-- On each use, the old jti is revoked and marked as replaced by the new jti.
-- This enables reuse detection: if a revoked token with replaced_by set is used again,
-- someone is replaying an old token and all tokens for that user should be revoked.
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "jti" text PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "replaced_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "refresh_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "refresh_tokens_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "refresh_tokens_replaced_by_fk" FOREIGN KEY ("replaced_by") REFERENCES "refresh_tokens"("jti")
);
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens"("user_id");
--> statement-breakpoint

-- 3. Email verification tokens: one-time use tokens with TTL
-- Raw 32-byte token is emailed to user; SHA-256 hash is stored in DB.
-- On successful verification, user row is updated and token marked used.
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "email_verification_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- 4. Password reset tokens: similar to email verification
-- One-time use with TTL. On successful reset, password_hash is updated,
-- token marked used, and all refresh tokens revoked.
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "password_reset_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- 5. SECURITY DEFINER functions (bypass RLS for pre-tenant auth operations)

-- Get refresh token details: called by /auth/refresh to validate the jti
CREATE OR REPLACE FUNCTION auth_get_refresh_token(p_jti text)
RETURNS TABLE (jti text, user_id uuid, org_id uuid, expires_at timestamptz,
               revoked_at timestamptz, replaced_by text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jti, user_id, org_id, expires_at, revoked_at, replaced_by
    FROM public.refresh_tokens WHERE jti = p_jti;
$$;
--> statement-breakpoint

-- Rotate a refresh token: atomically revoke old, insert new, and link via replaced_by
CREATE OR REPLACE FUNCTION auth_rotate_refresh_token(
  p_old_jti text, p_new_jti text, p_user_id uuid, p_org_id uuid, p_expires_at timestamptz
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.refresh_tokens
     SET revoked_at = now(), replaced_by = p_new_jti
   WHERE jti = p_old_jti;
  INSERT INTO public.refresh_tokens(jti, user_id, org_id, expires_at)
    VALUES (p_new_jti, p_user_id, p_org_id, p_expires_at);
$$;
--> statement-breakpoint

-- Reuse attack response: revoke all active tokens for user
CREATE OR REPLACE FUNCTION auth_revoke_all_for_user(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.refresh_tokens
     SET revoked_at = now()
   WHERE user_id = p_user_id AND revoked_at IS NULL;
$$;
--> statement-breakpoint

-- Use an email verification token: mark used, set user as verified
CREATE OR REPLACE FUNCTION auth_use_email_verification_token(p_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.email_verification_tokens
   WHERE token_hash = p_hash AND used_at IS NULL AND expires_at > now();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.email_verification_tokens SET used_at = now() WHERE token_hash = p_hash;
  UPDATE public.users SET email_verified = true WHERE id = v_user_id;
  RETURN v_user_id;
END;
$$;
--> statement-breakpoint

-- Use a password reset token: mark used, update password hash, revoke all sessions
CREATE OR REPLACE FUNCTION auth_use_password_reset_token(p_hash text, p_new_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.password_reset_tokens
   WHERE token_hash = p_hash AND used_at IS NULL AND expires_at > now();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.password_reset_tokens SET used_at = now() WHERE token_hash = p_hash;
  UPDATE public.users SET password_hash = p_new_hash WHERE id = v_user_id;
  -- Revoke all active sessions (refresh tokens) so old sessions are invalidated
  UPDATE public.refresh_tokens SET revoked_at = now()
   WHERE user_id = v_user_id AND revoked_at IS NULL;
  RETURN v_user_id;
END;
$$;
