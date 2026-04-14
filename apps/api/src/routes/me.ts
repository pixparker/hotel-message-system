import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, users } from "@hms/db";
import { userUpdateSchema } from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { normalizePhone } from "@hms/shared";

const db = getDb();

export const meRoutes = new Hono()
  .use(requireAuth)
  .get("/", async (c) => {
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
