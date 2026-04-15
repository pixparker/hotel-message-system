import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { auditEvents } from "@hms/db";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

/**
 * GET /api/audit?limit=50 — admin-only view of the tenant's audit log.
 * Staff users get 403. Supports `action` filter as ?action=auth.login.
 */
export const auditRoutes = new Hono()
  .get("/", requireAuth, withTenant, async (c) => {
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
    const actionFilter = c.req.query("action");

    const where = actionFilter
      ? and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, actionFilter))
      : eq(auditEvents.orgId, orgId);

    const rows = await db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
    return c.json(rows);
  });
