import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { getDb, users } from "@hms/db";
import { loginSchema } from "@hms/shared";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth.js";

const db = getDb();

export const authRoutes = new Hono()
  .post("/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);
    if (!user) return c.json({ error: "invalid_credentials" }, 401);
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return c.json({ error: "invalid_credentials" }, 401);
    const claims = { sub: user.id, orgId: user.orgId, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(claims),
      signRefreshToken(claims),
    ]);
    return c.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, testPhone: user.testPhone },
    });
  })
  .post("/refresh", async (c) => {
    const { refreshToken } = (await c.req.json()) as { refreshToken?: string };
    if (!refreshToken) return c.json({ error: "missing_token" }, 400);
    try {
      const claims = await verifyRefreshToken(refreshToken);
      const accessToken = await signAccessToken({
        sub: claims.sub,
        orgId: claims.orgId,
        role: claims.role,
      });
      return c.json({ accessToken });
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }
  });
