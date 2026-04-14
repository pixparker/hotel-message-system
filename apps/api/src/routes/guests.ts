import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { getDb, guests } from "@hms/db";
import { guestCreateSchema, guestUpdateSchema, normalizePhone } from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";

const db = getDb();

export const guestRoutes = new Hono()
  .use(requireAuth)
  .get("/", async (c) => {
    const status = c.req.query("status") as "checked_in" | "checked_out" | undefined;
    const orgId = currentOrgId(c);
    const rows = await db
      .select()
      .from(guests)
      .where(
        status
          ? and(eq(guests.orgId, orgId), eq(guests.status, status))
          : eq(guests.orgId, orgId),
      )
      .orderBy(desc(guests.checkedInAt));
    return c.json(rows);
  })
  .post("/", async (c) => {
    const body = guestCreateSchema.parse(await c.req.json());
    const orgId = currentOrgId(c);
    const phoneE164 = normalizePhone(body.phone);
    const [row] = await db
      .insert(guests)
      .values({
        orgId,
        name: body.name,
        phoneE164,
        language: body.language,
        roomNumber: body.roomNumber?.trim() || null,
        status: "checked_in",
      })
      .returning();
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const body = guestUpdateSchema.parse(await c.req.json());
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.phone) patch.phoneE164 = normalizePhone(body.phone);
    if (body.language) patch.language = body.language;
    if (body.roomNumber !== undefined)
      patch.roomNumber = body.roomNumber?.trim() || null;
    const [row] = await db
      .update(guests)
      .set(patch)
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .post("/:id/checkout", async (c) => {
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(guests)
      .set({ status: "checked_out", checkedOutAt: new Date() })
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .post("/:id/checkin", async (c) => {
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(guests)
      .set({ status: "checked_in", checkedOutAt: null, checkedInAt: new Date() })
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  });
