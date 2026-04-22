import { Hono } from "hono";
import { and, eq, desc, inArray } from "drizzle-orm";
import {
  campaigns,
  campaignAudiences,
  messages,
  contacts,
  contactAudiences,
  audiences,
  templates,
  organizations,
  settings,
} from "@hms/db";
import {
  campaignCreateSchema,
  testMessageSchema,
  renderForContact,
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

/**
 * Resolve recipient contacts from a set of audience ids. DISTINCT so a
 * contact in multiple selected audiences is counted once. Filters out
 * deactivated contacts — an inactive contact in Hotel Guests shouldn't
 * still receive marketing.
 */
async function resolveRecipientsByAudiences(
  db: TenantDb,
  orgId: string,
  audienceIds: string[],
) {
  if (audienceIds.length === 0) return [];
  return db
    .selectDistinct({
      id: contacts.id,
      orgId: contacts.orgId,
      name: contacts.name,
      phoneE164: contacts.phoneE164,
      language: contacts.language,
    })
    .from(contacts)
    .innerJoin(contactAudiences, eq(contactAudiences.contactId, contacts.id))
    .where(
      and(
        eq(contacts.orgId, orgId),
        eq(contacts.isActive, true),
        inArray(contactAudiences.audienceId, audienceIds),
      ),
    );
}

/**
 * Legacy hotel-status resolution — kept so old callers that don't pass
 * audienceIds still work while M6 swaps the frontend over.
 */
async function resolveRecipientsByStatus(
  db: TenantDb,
  orgId: string,
  status: "checked_in" | "checked_out",
) {
  return db
    .select({
      id: contacts.id,
      orgId: contacts.orgId,
      name: contacts.name,
      phoneE164: contacts.phoneE164,
      language: contacts.language,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, orgId),
        eq(contacts.isActive, true),
        eq(contacts.status, status),
      ),
    );
}

async function loadCampaignAudiences(
  db: TenantDb,
  orgId: string,
  campaignId: string,
) {
  return db
    .select({
      id: audiences.id,
      name: audiences.name,
      kind: audiences.kind,
      isSystem: audiences.isSystem,
    })
    .from(campaignAudiences)
    .innerJoin(audiences, eq(audiences.id, campaignAudiences.audienceId))
    .where(
      and(
        eq(campaignAudiences.campaignId, campaignId),
        eq(campaignAudiences.orgId, orgId),
      ),
    );
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
  /**
   * Preview the deduped recipient count and language breakdown for a
   * given set of audiences. Used by the send wizard step 3.
   */
  .get("/recipient-preview", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const raw = c.req.query("audienceIds") ?? "";
    const audienceIds = raw.split(",").map((s) => s.trim()).filter(Boolean);

    if (audienceIds.length === 0) {
      return c.json({ total: 0, byLanguage: [], sample: [] });
    }

    const rows = await resolveRecipientsByAudiences(db, orgId, audienceIds);

    const byLanguageMap = new Map<string, number>();
    for (const r of rows) {
      byLanguageMap.set(r.language, (byLanguageMap.get(r.language) ?? 0) + 1);
    }
    const byLanguage = Array.from(byLanguageMap.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    const sample = rows.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name,
      phoneE164: r.phoneE164,
    }));

    return c.json({ total: rows.length, byLanguage, sample });
  })
  .get("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)),
    });
    if (!campaign) return c.json({ error: "not_found" }, 404);
    const [msgRows, audienceRows] = await Promise.all([
      db.select().from(messages).where(eq(messages.campaignId, id)),
      loadCampaignAudiences(db, orgId, id),
    ]);
    return c.json({ ...campaign, messages: msgRows, audiences: audienceRows });
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const auth = c.get("auth");
    const orgId = currentOrgId(c);
    const body = campaignCreateSchema.parse(await c.req.json());
    const bodies = await resolveBodies(db, orgId, body);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const fallback = org?.defaultLanguage ?? "en";

    // Template approval gate: when the tenant uses the cloud provider, Meta
    // requires templates to be approved before they can be sent. Block here
    // to avoid queuing thousands of doomed messages. Mock provider is free-form.
    if (body.templateId) {
      const [orgSettings] = await db.select().from(settings).where(eq(settings.orgId, orgId));
      if (orgSettings?.waProvider === "cloud") {
        const [tpl] = await db
          .select()
          .from(templates)
          .where(and(eq(templates.id, body.templateId), eq(templates.orgId, orgId)));
        if (tpl && tpl.approvalStatus !== "approved") {
          return c.json(
            {
              error: "template_not_approved",
              status: tpl.approvalStatus,
            },
            400,
          );
        }
      }
    }

    // Prefer audience-based targeting; fall back to legacy status filter so
    // pre-M6 clients keep working.
    const useAudiences = body.audienceIds && body.audienceIds.length > 0;
    const recipients = useAudiences
      ? await resolveRecipientsByAudiences(db, orgId, body.audienceIds!)
      : await resolveRecipientsByStatus(db, orgId, body.recipientFilter.status);

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
        // Only persist the legacy filter when it's actually used.
        recipientFilter: useAudiences ? null : body.recipientFilter,
        status: "sending",
        totalsQueued: recipients.length,
        startedAt: new Date(),
      })
      .returning();

    // Snapshot which audiences this campaign targeted so reports stay
    // meaningful even if an audience is renamed or deleted later.
    if (useAudiences && campaign) {
      await db.insert(campaignAudiences).values(
        body.audienceIds!.map((audienceId) => ({
          campaignId: campaign.id,
          audienceId,
          orgId,
        })),
      );
    }

    const messageRows = await db
      .insert(messages)
      .values(
        recipients.map((g) => {
          const rendered = renderForContact(bodies, g, fallback);
          return {
            orgId,
            campaignId: campaign!.id,
            contactId: g.id,
            phoneE164: g.phoneE164,
            language: rendered.language,
            renderedBody: rendered.body,
            status: "queued" as const,
            // Unique per (org, campaign, contact) so retries can't double-send.
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
      metadata: {
        title: body.title,
        recipientCount: recipients.length,
        audienceIds: useAudiences ? body.audienceIds : null,
      },
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

    const rendered = renderForContact(
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
        // Test sends don't target anything — nullable recipient_filter now
        // makes this explicit rather than lying about a default.
        recipientFilter: null,
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
        // Test sends have no contact; use the campaign id (test campaigns are single-message).
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
