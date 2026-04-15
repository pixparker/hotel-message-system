import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { getDb, refreshTokens, users, organizations, emailVerificationTokens, passwordResetTokens, settings } from "@hms/db";
import { loginSchema, registerSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from "@hms/shared";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth.js";
import { env } from "../env.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../mailer.js";
import { rateLimit, clientIp } from "../rate-limit.js";
import { auditLog, auditContext } from "../audit.js";

const db = getDb();

// Per-IP limiter on auth endpoints to slow brute-force attempts.
const authLimiter = rateLimit({
  windowSec: 60,
  max: 10,
  prefix: "rl:auth",
  keyFrom: clientIp,
});

type AuthUserRow = {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  role: "admin" | "staff";
  test_phone: string | null;
  email_verified: boolean;
};

/**
 * Generate a random token and return both the raw token and its SHA-256 hash.
 * The raw token is sent to the user; the hash is stored in the DB.
 */
function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/**
 * Hash a new password with bcrypt (cost 12).
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const EMAIL_TOKEN_TTL_MINUTES = 15;
const PASSWORD_RESET_TTL_MINUTES = 15;

export const authRoutes = new Hono()
  .use(authLimiter)
  .post("/register", async (c) => {
    try {
      const body = registerSchema.parse(await c.req.json());

      // Check if email is already in use
      const existing = (await db.execute(
        sql`SELECT id FROM auth_find_user_by_email(${body.email.toLowerCase()})`,
      )) as unknown as Array<{ id: string }>;
      if (existing.length > 0) {
        return c.json({ error: "email_already_in_use" }, 400);
      }

      // Create org
      const [org] = await db.insert(organizations).values({ name: body.orgName, defaultLanguage: "en" }).returning();
      if (!org) throw new Error("Failed to create organization");

      // Create user (email not verified yet)
      const passwordHash = await hashPassword(body.password);
      const [user] = await db
        .insert(users)
        .values({
          orgId: org.id,
          email: body.email.toLowerCase(),
          passwordHash,
          role: "admin",
          emailVerified: false,
        })
        .returning();
      if (!user) throw new Error("Failed to create user");

      // Create settings row
      await db.insert(settings).values({
        orgId: org.id,
        waProvider: "mock",
        brandPrimaryColor: "#14a77a",
      });

      // Create email verification token
      const { raw: verifyToken, hash: verifyHash } = generateToken();
      const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MINUTES * 60 * 1000);
      await db.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash: verifyHash,
        expiresAt,
      });

      // Send verification email
      const verifyUrl = `${env.WEB_ORIGIN}/verify-email?token=${verifyToken}`;
      await sendVerificationEmail(user.email, verifyUrl);

      const ctx = auditContext(c);
      await auditLog({
        orgId: org.id,
        userId: user.id,
        action: "auth.register",
        target: user.id,
        metadata: { email: user.email, orgName: body.orgName },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return c.json({ message: "check your email to verify your account" }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "registration failed";
      return c.json({ error: message }, 500);
    }
  })

  .post("/verify-email", async (c) => {
    try {
      const body = verifyEmailSchema.parse(await c.req.json());
      const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");

      const rows = (await db.execute(
        sql`SELECT auth_use_email_verification_token(${tokenHash}) AS user_id`,
      )) as unknown as Array<{ user_id: string | null }>;
      const userId = rows[0]?.user_id;

      if (!userId) {
        return c.json({ error: "invalid_or_expired_token" }, 400);
      }

      return c.json({ message: "email verified! please log in." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "verification failed";
      return c.json({ error: message }, 500);
    }
  })

  .post("/forgot-password", async (c) => {
    try {
      const body = forgotPasswordSchema.parse(await c.req.json());

      // Find user by email (SECURITY DEFINER function)
      const rows = (await db.execute(
        sql`SELECT id, org_id FROM auth_find_user_by_email(${body.email.toLowerCase()})`,
      )) as unknown as Array<{ id: string; org_id: string }>;
      const user = rows[0];

      // Always return 200 to avoid leaking email existence
      if (!user) {
        return c.json({ message: "if that email exists, a reset link was sent" });
      }

      // Create password reset token
      const { raw: resetToken, hash: resetHash } = generateToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: resetHash,
        expiresAt,
      });

      // Send reset email
      const resetUrl = `${env.WEB_ORIGIN}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(body.email, resetUrl);

      return c.json({ message: "if that email exists, a reset link was sent" });
    } catch (err) {
      console.error("forgot-password error:", err);
      return c.json({ message: "if that email exists, a reset link was sent" });
    }
  })

  .post("/reset-password", async (c) => {
    try {
      const body = resetPasswordSchema.parse(await c.req.json());
      const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
      const newPasswordHash = await hashPassword(body.password);

      const rows = (await db.execute(
        sql`SELECT auth_use_password_reset_token(${tokenHash}, ${newPasswordHash}) AS user_id`,
      )) as unknown as Array<{ user_id: string | null }>;
      const userId = rows[0]?.user_id;

      if (!userId) {
        return c.json({ error: "invalid_or_expired_token" }, 400);
      }

      return c.json({ message: "password updated! please log in." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "password reset failed";
      return c.json({ error: message }, 500);
    }
  })

  .post("/login", async (c) => {
    try {
      const body = loginSchema.parse(await c.req.json());
      const ctx = auditContext(c);

      // RLS-bypassing SECURITY DEFINER function — login has no tenant context yet.
      const rows = (await db.execute(
        sql`SELECT * FROM auth_find_user_by_email(${body.email.toLowerCase()})`,
      )) as unknown as AuthUserRow[];
      const user = rows[0];
      if (!user) {
        await auditLog({
          action: "auth.login_failed",
          metadata: { email: body.email, reason: "unknown_email" },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return c.json({ error: "invalid_credentials" }, 401);
      }

      const ok = await bcrypt.compare(body.password, user.password_hash);
      if (!ok) {
        await auditLog({
          orgId: user.org_id,
          userId: user.id,
          action: "auth.login_failed",
          target: user.id,
          metadata: { email: user.email, reason: "bad_password" },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
        return c.json({ error: "invalid_credentials" }, 401);
      }

      // Generate jti (JWT ID) for this refresh token session
      const jti = crypto.randomUUID();

      const claims = {
        sub: user.id,
        orgId: user.org_id,
        role: user.role,
        emailVerified: user.email_verified,
        jti,
      };

      // Sign tokens
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(claims),
        signRefreshToken(claims),
      ]);

      // Store refresh token in DB
      const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);
      await db.insert(refreshTokens).values({
        jti,
        userId: user.id,
        orgId: user.org_id,
        expiresAt,
      });

      await auditLog({
        orgId: user.org_id,
        userId: user.id,
        action: "auth.login",
        target: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return c.json({
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, role: user.role, testPhone: user.test_phone },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "login failed";
      return c.json({ error: message }, 500);
    }
  })

  .post("/refresh", async (c) => {
    try {
      const { refreshToken } = (await c.req.json()) as { refreshToken?: string };
      if (!refreshToken) return c.json({ error: "missing_token" }, 400);

      // Verify JWT signature
      const claims = await verifyRefreshToken(refreshToken);

      // Look up token in DB
      const rows = (await db.execute(
        sql`SELECT * FROM auth_get_refresh_token(${claims.jti})`,
      )) as unknown as Array<{
        jti: string;
        user_id: string;
        org_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        replaced_by: string | null;
      }>;
      const tokenRow = rows[0];

      // Token not found
      if (!tokenRow) {
        return c.json({ error: "invalid_token" }, 401);
      }

      // Token has been revoked and replaced (rotation)
      if (tokenRow.revoked_at && tokenRow.replaced_by) {
        // This looks like a normal rotation, shouldn't happen on a normal refresh
        return c.json({ error: "invalid_token" }, 401);
      }

      // Reuse attack: revoked token being replayed
      if (tokenRow.revoked_at) {
        // Revoke all tokens for this user
        await db.execute(sql`SELECT auth_revoke_all_for_user(${tokenRow.user_id})`);
        return c.json({ error: "token_reuse_detected" }, 401);
      }

      // Token expired
      if (new Date() > tokenRow.expires_at) {
        return c.json({ error: "invalid_token" }, 401);
      }

      // Generate new jti for rotation
      const newJti = crypto.randomUUID();
      const newExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);

      // Rotate: mark old jti as revoked, insert new jti, link via replaced_by
      await db.execute(
        sql`SELECT auth_rotate_refresh_token(${claims.jti}, ${newJti}, ${tokenRow.user_id}, ${tokenRow.org_id}, ${newExpiresAt})`,
      );

      // Create new claims with new jti
      const newClaims = {
        sub: claims.sub,
        orgId: claims.orgId,
        role: claims.role,
        emailVerified: claims.emailVerified,
        jti: newJti,
      };

      const [accessToken, newRefreshToken] = await Promise.all([
        signAccessToken(newClaims),
        signRefreshToken(newClaims),
      ]);

      return c.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
      const message = err instanceof Error ? err.message : "refresh failed";
      console.error("refresh error:", err);
      return c.json({ error: message }, 401);
    }
  });
