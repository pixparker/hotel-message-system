import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import {
  campaigns,
  messages,
  guests,
  templates,
  organizations,
} from "@hms/db";
import {
  campaignCreateSchema,
  testMessageSchema,
  renderForGuest,
  normalizePhone,
} from "@hms/shared";
import { requireAuth, requireVerified, currentOrgId } from "../auth.js";
import { withTenant, type TenantDb } from "../tenant.js";
import { sendMessageQueue } from "../redis.js";
import { rateLimit } from "../rate-limit.js";
import { auditLog, auditContext } from "../audit.js";

// Per-org limiter: prevents one tenant from flooding the queue at the expense of others.
const campaignLimiter = rateLimit({
  windowSec: 60,
  max: 30,
  prefix: "rl:campaigns",
  keyFrom: (c) => {
    const claims = c.get("auth");
    return claims?.orgId;
  },
});

async function resolveBodies(
  db: TenantDb,
  orgId: string,
  input: { templateId?: string; customBodies?: Record<string, string> },
): Promise<Record<string, string>> {
  if (input.customBodies && Object.keys(input.customBodies).length > 0) {
    return input.customBodies;
  }
  if (!input.templateId) throw new Error("no bodies provided");
  const tpl = await db.query.templates.findFirst({
    where: and(eq(templates.id, input.templateId), eq(templates.orgId, orgId)),
    with: { bodies: true },
  });
  if (!tpl) throw new Error("template not found");
  return Object.fromEntries(tpl.bodies.map((b) => [b.language, b.body]));
}

export const campaignRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .use(requireVerified)
  .use(campaignLimiter)
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const rows = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);
    return c.json(rows);
  })
  .get("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)),
    });
    if (!campaign) return c.json({ error: "not_found" }, 404);
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, id));
    return c.json({ ...campaign, messages: rows });
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const auth = c.get("auth");
    const orgId = currentOrgId(c);
    const body = campaignCreateSchema.parse(await c.req.json());
    const bodies = await resolveBodies(db, orgId, body);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const fallback = org?.defaultLanguage ?? "en";

    const recipients = await db
      .select()
      .from(guests)
      .where(and(eq(guests.orgId, orgId), eq(guests.status, body.recipientFilter.status)));

    if (recipients.length === 0) {
      return c.json({ error: "no_recipients" }, 400);
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        orgId,
        createdBy: auth.sub,
        title: body.title,
        templateId: body.templateId,
        customBodies: body.customBodies ?? null,
        recipientFilter: body.recipientFilter,
        status: "sending",
        totalsQueued: recipients.length,
        startedAt: new Date(),
      })
      .returning();

    const messageRows = await db
      .insert(messages)
      .values(
        recipients.map((g) => {
          const rendered = renderForGuest(bodies, g, fallback);
          return {
            orgId,
            campaignId: campaign!.id,
            guestId: g.id,
            phoneE164: g.phoneE164,
            language: rendered.language,
            renderedBody: rendered.body,
            status: "queued" as const,
            // Unique per (org, campaign, guest) so retries can't double-send.
            idempotencyKey: `${campaign!.id}:${g.id}`,
          };
        }),
      )
      .returning();

    await sendMessageQueue.addBulk(
      messageRows.map((m) => ({
        name: "send",
        data: { messageId: m.id, campaignId: campaign!.id, orgId },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
      })),
    );

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: auth.sub,
      action: "campaign.create",
      target: campaign!.id,
      metadata: { title: body.title, recipientCount: recipients.length },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return c.json(campaign, 201);
  })
  .post("/test", async (c) => {
    const db = c.var.db;
    const auth = c.get("auth");
    const orgId = currentOrgId(c);
    const body = testMessageSchema.parse(await c.req.json());
    const bodies = await resolveBodies(db, orgId, body);
    const phoneE164 = normalizePhone(body.phone);

    const rendered = renderForGuest(
      bodies,
      { name: "Test", phoneE164, language: body.language },
      "en",
    );

    const [campaign] = await db
      .insert(campaigns)
      .values({
        orgId,
        createdBy: auth.sub,
        title: `Test: ${rendered.body.slice(0, 40)}`,
        templateId: body.templateId,
        customBodies: body.customBodies ?? null,
        recipientFilter: { status: "checked_in" },
        isTest: true,
        status: "sending",
        totalsQueued: 1,
        startedAt: new Date(),
      })
      .returning();

    const [msg] = await db
      .insert(messages)
      .values({
        orgId,
        campaignId: campaign!.id,
        phoneE164,
        language: rendered.language,
        renderedBody: rendered.body,
        status: "queued",
        // Test sends have no guest; use the campaign id (test campaigns are single-message).
        idempotencyKey: `test:${campaign!.id}`,
      })
      .returning();

    await sendMessageQueue.add(
      "send",
      { messageId: msg!.id, campaignId: campaign!.id, orgId },
      { attempts: 3 },
    );

    return c.json({ campaignId: campaign!.id, messageId: msg!.id }, 201);
  })
  .post("/:id/cancel", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(campaigns)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  });
