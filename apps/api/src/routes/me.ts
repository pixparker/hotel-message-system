import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "@hms/db";
import { userUpdateSchema, normalizePhone } from "@hms/shared";
import { requireAuth } from "../auth.js";
import { withTenant } from "../tenant.js";

export const meRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/", async (c) => {
    const db = c.var.db;
    const auth = c.get("auth");
    const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1);
    if (!user) return c.json({ error: "not_found" }, 404);
    return c.json({
      id: user.id,
      email: user.email,
      role: user.role,
      testPhone: user.testPhone,
      orgId: user.orgId,
    });
  })
  .patch("/", async (c) => {
    const db = c.var.db;
    const auth = c.get("auth");
    const body = userUpdateSchema.parse(await c.req.json());
    const testPhone = body.testPhone ? normalizePhone(body.testPhone) : undefined;
    const [updated] = await db
      .update(users)
      .set({ testPhone })
      .where(eq(users.id, auth.sub))
      .returning();
    return c.json({ testPhone: updated?.testPhone });
  });
