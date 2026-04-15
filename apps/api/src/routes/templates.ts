import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { templates, templateBodies } from "@hms/db";
import { templateCreateSchema } from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

export const templateRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const rows = await db.query.templates.findMany({
      where: eq(templates.orgId, orgId),
      with: { bodies: true },
      orderBy: desc(templates.createdAt),
    });
    return c.json(rows);
  })
  .get("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const row = await db.query.templates.findFirst({
      where: and(eq(templates.id, id), eq(templates.orgId, orgId)),
      with: { bodies: true },
    });
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const body = templateCreateSchema.parse(await c.req.json());
    const orgId = currentOrgId(c);
    const [tpl] = await db
      .insert(templates)
      .values({ orgId, name: body.name, description: body.description })
      .returning();
    await db.insert(templateBodies).values(
      body.bodies.map((b) => ({
        templateId: tpl!.id,
        orgId,
        language: b.language,
        body: b.body,
      })),
    );
    const full = await db.query.templates.findFirst({
      where: eq(templates.id, tpl!.id),
      with: { bodies: true },
    });
    return c.json(full, 201);
  })
  .patch("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const body = templateCreateSchema.parse(await c.req.json());
    const [existing] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, orgId)))
      .limit(1);
    if (!existing) return c.json({ error: "not_found" }, 404);

    await db
      .update(templates)
      .set({ name: body.name, description: body.description })
      .where(eq(templates.id, id));
    await db.delete(templateBodies).where(eq(templateBodies.templateId, id));
    await db.insert(templateBodies).values(
      body.bodies.map((b) => ({
        templateId: id,
        orgId,
        language: b.language,
        body: b.body,
      })),
    );
    const full = await db.query.templates.findFirst({
      where: eq(templates.id, id),
      with: { bodies: true },
    });
    return c.json(full);
  })
  .delete("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const deleted = await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, orgId)))
      .returning();
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });
