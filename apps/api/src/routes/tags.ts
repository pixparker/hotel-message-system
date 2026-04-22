import { Hono } from "hono";
import { and, eq, sql, asc } from "drizzle-orm";
import { tags, contactTags } from "@hms/db";
import { tagCreateSchema, tagUpdateSchema } from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

export const tagRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  /**
   * List tags with usage counts (how many contacts carry each tag).
   */
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const rows = await db
      .select({
        id: tags.id,
        label: tags.label,
        color: tags.color,
        createdAt: tags.createdAt,
        usageCount: sql<number>`count(${contactTags.contactId})::int`,
      })
      .from(tags)
      .leftJoin(contactTags, eq(contactTags.tagId, tags.id))
      .where(eq(tags.orgId, orgId))
      .groupBy(tags.id)
      .orderBy(asc(tags.label));
    return c.json(rows);
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const body = tagCreateSchema.parse(await c.req.json());
    const [row] = await db
      .insert(tags)
      .values({
        orgId,
        label: body.label.trim(),
        color: body.color ?? null,
      })
      .returning();
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const id = c.req.param("id");
    const body = tagUpdateSchema.parse(await c.req.json());
    const patch: Record<string, unknown> = {};
    if (body.label !== undefined) patch.label = body.label.trim();
    if (body.color !== undefined) patch.color = body.color ?? null;

    const [row] = await db
      .update(tags)
      .set(patch)
      .where(and(eq(tags.id, id), eq(tags.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const id = c.req.param("id");
    await db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.orgId, orgId)));
    return c.json({ ok: true });
  });
