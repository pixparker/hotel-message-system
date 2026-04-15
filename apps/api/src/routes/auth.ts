import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { getDb } from "@hms/db";
import { loginSchema } from "@hms/shared";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth.js";

const db = getDb();

type AuthUserRow = {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  role: "admin" | "staff";
  test_phone: string | null;
};

export const authRoutes = new Hono()
  .post("/login", async (c) => {
    const body = loginSchema.parse(await c.req.json());
    // RLS-bypassing SECURITY DEFINER function — login has no tenant context yet.
    const rows = (await db.execute(
      sql`SELECT * FROM auth_find_user_by_email(${body.email.toLowerCase()})`,
    )) as unknown as AuthUserRow[];
    const user = rows[0];
    if (!user) return c.json({ error: "invalid_credentials" }, 401);
    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) return c.json({ error: "invalid_credentials" }, 401);
    const claims = { sub: user.id, orgId: user.org_id, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(claims),
      signRefreshToken(claims),
    ]);
    return c.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, testPhone: user.test_phone },
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
