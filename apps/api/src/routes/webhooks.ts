import { Hono } from "hono";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { getDb, webhookEvents } from "@hms/db";
import { env } from "../env.js";
import { log } from "../log.js";
import { redis } from "../redis.js";
import { decryptSecret } from "../crypto.js";

const db = getDb();

type SettingsLookup = { org_id: string; app_secret: string | null };

/**
 * Extract the Meta phone_number_id from a webhook payload.
 * Meta payload shape: { entry: [{ changes: [{ value: { metadata: { phone_number_id } } }] }] }
 */
function extractPhoneNumberId(payload: unknown): string | null {
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: { metadata?: { phone_number_id?: string } };
      }>;
    }>;
  };
  return p?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}

/**
 * Look up the tenant settings for a given Meta phone_number_id.
 * Uses a SECURITY DEFINER function so it works without tenant context (RLS bypass).
 */
async function findSettingsByPhoneNumberId(
  phoneNumberId: string,
): Promise<SettingsLookup | null> {
  const rows = (await db.execute(
    sql`SELECT org_id, app_secret FROM webhook_find_settings_by_phone_number_id(${phoneNumberId})`,
  )) as unknown as SettingsLookup[];
  return rows[0] ?? null;
}

/**
 * Persist a rejected webhook to webhook_events for security auditing.
 * orgId may be null when the rejection happened before we could identify the tenant.
 */
async function persistRejection(
  orgId: string | null,
  reason: string,
  payload: unknown,
): Promise<void> {
  await db.insert(webhookEvents).values({
    provider: "cloud",
    orgId: orgId ?? undefined,
    payload: (payload ?? {}) as Record<string, unknown>,
    rejected: true,
    rejectionReason: reason,
  });
}

/**
 * Cloud API webhook receiver. Verifies the Meta X-Hub-Signature-256 HMAC
 * against the per-tenant app secret stored in settings.waConfig, and routes
 * incoming events by phone_number_id.
 */
export const webhookRoutes = new Hono()
  .get("/whatsapp", (c) => {
    // Meta verification handshake (one-time setup, no per-tenant context).
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");
    const expected = env.WA_CLOUD_VERIFY_TOKEN;
    if (mode === "subscribe" && expected && token === expected && challenge) {
      return c.text(challenge, 200);
    }
    return c.text("forbidden", 403);
  })
  .post("/whatsapp", async (c) => {
    // Read the raw body BEFORE JSON parsing — the HMAC signature is over the raw bytes.
    const rawBody = await c.req.text();
    const signatureHeader = c.req.header("x-hub-signature-256") ?? "";

    // 1. Parse JSON
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      await persistRejection(null, "malformed_json", { raw: rawBody.slice(0, 500) });
      return c.json({ error: "malformed_json" }, 400);
    }

    // 2. Extract phone_number_id from the Meta payload
    const phoneNumberId = extractPhoneNumberId(payload);
    if (!phoneNumberId) {
      await persistRejection(null, "missing_phone_number_id", payload);
      return c.json({ error: "missing_phone_number_id" }, 400);
    }

    // 3. Look up tenant by phone_number_id
    const settings = await findSettingsByPhoneNumberId(phoneNumberId);
    if (!settings) {
      await persistRejection(null, "unknown_phone_number_id", payload);
      return c.json({ error: "not_found" }, 404);
    }

    const { org_id: orgId, app_secret: storedAppSecret } = settings;

    // 4. Tenant must have configured an app secret to verify against.
    //    App secrets are encrypted at rest; decrypt before using for HMAC.
    const appSecret = storedAppSecret ? decryptSecret(storedAppSecret) : null;
    if (!appSecret) {
      await persistRejection(orgId, "tenant_missing_app_secret", payload);
      log.warn({ orgId, phoneNumberId }, "tenant has no appSecret configured");
      return c.json({ error: "configuration_error" }, 500);
    }

    // 5. Compute expected signature and compare with timing-safe equality
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signatureHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      await persistRejection(orgId, "invalid_signature", payload);
      log.warn({ orgId, phoneNumberId }, "webhook signature verification failed");
      return c.json({ error: "invalid_signature" }, 401);
    }

    // 6. Accepted — persist with org context and publish to the worker
    //    via Redis pub/sub so it can update message status.
    await db.insert(webhookEvents).values({
      provider: "cloud",
      orgId,
      payload: payload as Record<string, unknown>,
      rejected: false,
    });

    await redis.publish(
      "wa:webhook",
      JSON.stringify({ orgId, payload }),
    );

    return c.json({ ok: true });
  });
