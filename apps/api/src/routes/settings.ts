import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { settings } from "@hms/db";
import { settingsUpdateSchema, normalizePhone } from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

export const settingsRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const [row] = await db.select().from(settings).where(eq(settings.orgId, orgId));
    return c.json(row ?? null);
  })
  .patch("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = settingsUpdateSchema.parse(await c.req.json());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.waProvider) patch.waProvider = body.waProvider;
    if (body.waConfig) patch.waConfig = body.waConfig;
    if (body.defaultTestPhone) patch.defaultTestPhone = normalizePhone(body.defaultTestPhone);
    if (body.brandPrimaryColor !== undefined)
      patch.brandPrimaryColor = body.brandPrimaryColor ?? null;
    const [row] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.orgId, orgId))
      .returning();
    return c.json(row);
  });
