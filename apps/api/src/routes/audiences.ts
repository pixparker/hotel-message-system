import { Hono } from "hono";
import { and, asc, eq, sql } from "drizzle-orm";
import { audiences, contactAudiences, contacts } from "@hms/db";
import {
  audienceCreateSchema,
  audienceUpdateSchema,
  audienceMembershipSchema,
} from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

export const audienceRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  /**
   * List audiences with member counts, ordered system-first then alphabetical.
   */
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const rows = await db
      .select({
        id: audiences.id,
        name: audiences.name,
        kind: audiences.kind,
        description: audiences.description,
        isSystem: audiences.isSystem,
        createdAt: audiences.createdAt,
        memberCount: sql<number>`count(${contactAudiences.contactId})::int`,
      })
      .from(audiences)
      .leftJoin(
        contactAudiences,
        eq(contactAudiences.audienceId, audiences.id),
      )
      .where(eq(audiences.orgId, orgId))
      .groupBy(audiences.id)
      .orderBy(
        sql`${audiences.isSystem} desc`,
        audiences.kind,
        audiences.name,
      );
    return c.json(rows);
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const body = audienceCreateSchema.parse(await c.req.json());
    const [row] = await db
      .insert(audiences)
      .values({
        orgId,
        name: body.name.trim(),
        kind: body.kind ?? "custom",
        description: body.description ?? null,
        isSystem: false,
      })
      .returning();
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const id = c.req.param("id");
    const body = audienceUpdateSchema.parse(await c.req.json());

    const [existing] = await db
      .select({ isSystem: audiences.isSystem })
      .from(audiences)
      .where(and(eq(audiences.id, id), eq(audiences.orgId, orgId)));
    if (!existing) return c.json({ error: "not_found" }, 404);
    if (existing.isSystem) {
      return c.json({ error: "system_audience_immutable" }, 409);
    }

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.description !== undefined)
      patch.description = body.description ?? null;
    if (body.kind !== undefined) patch.kind = body.kind;

    const [row] = await db
      .update(audiences)
      .set(patch)
      .where(and(eq(audiences.id, id), eq(audiences.orgId, orgId)))
      .returning();
    return c.json(row);
  })
  .delete("/:id", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const id = c.req.param("id");

    const [existing] = await db
      .select({ isSystem: audiences.isSystem })
      .from(audiences)
      .where(and(eq(audiences.id, id), eq(audiences.orgId, orgId)));
    if (!existing) return c.json({ error: "not_found" }, 404);
    if (existing.isSystem) {
      return c.json({ error: "system_audience_immutable" }, 409);
    }

    await db
      .delete(audiences)
      .where(and(eq(audiences.id, id), eq(audiences.orgId, orgId)));
    return c.json({ ok: true });
  })
  /**
   * List members of an audience.
   */
  .get("/:id/contacts", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const audienceId = c.req.param("id");
    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        phoneE164: contacts.phoneE164,
        language: contacts.language,
        source: contacts.source,
        isActive: contacts.isActive,
        roomNumber: contacts.roomNumber,
        createdAt: contacts.createdAt,
      })
      .from(contactAudiences)
      .innerJoin(contacts, eq(contacts.id, contactAudiences.contactId))
      .where(
        and(
          eq(contactAudiences.audienceId, audienceId),
          eq(contactAudiences.orgId, orgId),
        ),
      )
      .orderBy(asc(contacts.name));
    return c.json(rows);
  })
  /**
   * Bulk-add contacts to an audience. Duplicates silently ignored.
   */
  .post("/:id/contacts", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const audienceId = c.req.param("id");
    const body = audienceMembershipSchema.parse(await c.req.json());

    // Verify audience belongs to org.
    const [aud] = await db
      .select({ id: audiences.id })
      .from(audiences)
      .where(and(eq(audiences.id, audienceId), eq(audiences.orgId, orgId)));
    if (!aud) return c.json({ error: "not_found" }, 404);

    await db
      .insert(contactAudiences)
      .values(
        body.contactIds.map((contactId) => ({
          contactId,
          audienceId,
          orgId,
        })),
      )
      .onConflictDoNothing();

    return c.json({ added: body.contactIds.length });
  })
  /**
   * Bulk-remove contacts from an audience.
   */
  .delete("/:id/contacts", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const audienceId = c.req.param("id");
    const body = audienceMembershipSchema.parse(await c.req.json());

    for (const contactId of body.contactIds) {
      await db
        .delete(contactAudiences)
        .where(
          and(
            eq(contactAudiences.audienceId, audienceId),
            eq(contactAudiences.contactId, contactId),
            eq(contactAudiences.orgId, orgId),
          ),
        );
    }

    return c.json({ removed: body.contactIds.length });
  });
