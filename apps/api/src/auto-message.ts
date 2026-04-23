import { and, eq } from "drizzle-orm";
import {
  campaigns,
  contacts,
  messages,
  organizations,
  settings,
  templates,
  type ModulesState,
} from "@hms/db";
import { renderForContact } from "@hms/shared";
import type { TenantDb } from "./tenant.js";
import { sendMessageQueue } from "./redis.js";

/**
 * Outcome of a triggered auto-message attempt. Returned to the caller (the
 * checkin/checkout endpoint) so the UI can surface a toast — without leaking
 * driver internals or partial DB state on failure.
 */
export type AutoMessageResult =
  | { triggered: true; campaignId: string; templateName: string }
  | { triggered: false; reason: AutoMessageSkipReason };

export type AutoMessageSkipReason =
  | "module_disabled"
  | "auto_disabled"
  | "no_template"
  | "template_missing"
  | "no_phone"
  | "send_failed";

export type AutoTrigger = "check_in" | "check_out";

/**
 * Attempt to send the configured Check-In module auto-message for a contact.
 *
 * Reuses the existing campaign infrastructure: each automated send becomes a
 * single-recipient campaign with `origin = auto_check_in | auto_check_out`,
 * so reports and the worker pipeline see the same shape they always have.
 * Skip reasons are returned (not thrown) — a missing template should not
 * fail the underlying check-in API.
 */
export async function triggerAutoMessage(opts: {
  db: TenantDb;
  orgId: string;
  contactId: string;
  trigger: AutoTrigger;
  createdBy: string;
}): Promise<AutoMessageResult> {
  const { db, orgId, contactId, trigger, createdBy } = opts;

  const [orgSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.orgId, orgId));
  const modules: ModulesState = orgSettings?.modules ?? {};
  const checkIn = modules.checkIn;
  // Default ON for any workspace that hasn't explicitly turned the module off
  // — keeps existing orgs (whose settings row predates this column) and
  // freshly-signed-up orgs benefiting from automation without an opt-in step.
  const enabled = checkIn?.enabled ?? true;
  if (!enabled) return { triggered: false, reason: "module_disabled" };

  const templateId =
    trigger === "check_in" ? checkIn?.checkInTemplateId : checkIn?.checkOutTemplateId;
  if (!templateId) return { triggered: false, reason: "no_template" };

  const tpl = await db.query.templates.findFirst({
    where: and(eq(templates.id, templateId), eq(templates.orgId, orgId)),
    with: { bodies: true },
  });
  if (!tpl || tpl.bodies.length === 0) {
    return { triggered: false, reason: "template_missing" };
  }

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)));
  if (!contact || !contact.phoneE164) {
    return { triggered: false, reason: "no_phone" };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId));
  const fallbackLanguage = org?.defaultLanguage ?? "en";

  const bodies = Object.fromEntries(tpl.bodies.map((b) => [b.language, b.body]));
  const rendered = renderForContact(bodies, contact, fallbackLanguage);

  const origin = trigger === "check_in" ? "auto_check_in" : "auto_check_out";
  const title =
    trigger === "check_in"
      ? `Auto check-in: ${contact.name}`
      : `Auto check-out: ${contact.name}`;

  try {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        orgId,
        createdBy,
        title,
        templateId,
        origin,
        status: "sending",
        totalsQueued: 1,
        startedAt: new Date(),
      })
      .returning();
    if (!campaign) return { triggered: false, reason: "send_failed" };

    const [message] = await db
      .insert(messages)
      .values({
        orgId,
        campaignId: campaign.id,
        contactId: contact.id,
        phoneE164: contact.phoneE164,
        language: rendered.language,
        renderedBody: rendered.body,
        status: "queued",
        idempotencyKey: `${campaign.id}:${contact.id}`,
      })
      .returning();
    if (!message) return { triggered: false, reason: "send_failed" };

    await sendMessageQueue.add(
      "send",
      { messageId: message.id, campaignId: campaign.id, orgId },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );

    return { triggered: true, campaignId: campaign.id, templateName: tpl.name };
  } catch {
    return { triggered: false, reason: "send_failed" };
  }
}
