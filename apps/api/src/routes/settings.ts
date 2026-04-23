import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { settings, waBaileysSessions } from "@hms/db";
import { settingsUpdateSchema, normalizePhone } from "@hms/shared";
import { CloudWaDriver } from "@hms/wa-driver";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";
import { auditLog, auditContext } from "../audit.js";
import { encryptSecret } from "../crypto.js";
import {
  redis,
  subRedis,
  WA_CONTROL_CHANNEL,
  baileysPairChannel,
} from "../redis.js";

const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  appSecret: z.string().min(1),
  testPhone: z.string().min(1),
});

const baileysConnectSchema = z.object({
  // All four acknowledgments must be ticked before the QR is rendered.
  acknowledgeDedicatedNumber: z.literal(true),
  acknowledgeBanRisk: z.literal(true),
  acknowledgeNoColdOutreach: z.literal(true),
  acknowledgeAcceptRisk: z.literal(true),
});

const baileysSafetySchema = z.object({
  throttleMode: z.enum(["careful", "balanced", "custom"]).optional(),
  customRatePerMin: z.number().int().min(1).max(60).nullable().optional(),
  dailyCap: z.number().int().min(10).max(1000).optional(),
  coldPolicy: z.enum(["warn", "block", "allow"]).optional(),
});

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
    if (body.modules) {
      // Shallow-merge so a PATCH that only touches one module's keys does not
      // wipe other modules' state. The JSONB column lives at the org level
      // and accumulates one entry per shipped module.
      const [current] = await db.select().from(settings).where(eq(settings.orgId, orgId));
      patch.modules = { ...(current?.modules ?? {}), ...body.modules };
    }
    const [row] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.orgId, orgId))
      .returning();

    const ctx = auditContext(c);
    const changedKeys = Object.keys(body).filter((k) => k !== "waConfig");
    if (body.waConfig) changedKeys.push("waConfig.*");
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "settings.update",
      target: orgId,
      metadata: { changedKeys },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return c.json(row);
  })
  /**
   * Guided WhatsApp connect wizard backend (Meta Cloud API).
   * Validates credentials via a test send before persisting encrypted tokens.
   */
  .post("/whatsapp/connect", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = connectWhatsAppSchema.parse(await c.req.json());

    try {
      const driver = new CloudWaDriver({
        accessToken: body.accessToken,
        phoneNumberId: body.phoneNumberId,
      });
      await driver.sendText(
        normalizePhone(body.testPhone),
        "Your WhatsApp business account is connected. You're ready to send.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "test_send_failed";
      return c.json({ error: "test_send_failed", detail: message }, 400);
    }

    const encryptedToken = encryptSecret(body.accessToken);
    const encryptedAppSecret = encryptSecret(body.appSecret);

    const [row] = await db
      .update(settings)
      .set({
        waProvider: "cloud",
        waConfig: {
          phoneNumberId: body.phoneNumberId,
          wabaId: body.wabaId,
          accessToken: encryptedToken,
          appSecret: encryptedAppSecret,
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.orgId, orgId))
      .returning();

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "whatsapp.connect",
      target: orgId,
      metadata: { phoneNumberId: body.phoneNumberId, wabaId: body.wabaId },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return c.json(row);
  })
  /**
   * Baileys (unofficial / WhatsApp Web) — status snapshot. Used by the UI to
   * decide which card to render (QR flow vs Connected banner vs logout alert).
   */
  .get("/whatsapp/baileys/status", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const [row] = await db
      .select()
      .from(waBaileysSessions)
      .where(eq(waBaileysSessions.orgId, orgId));
    if (!row) {
      return c.json({ status: "none" as const });
    }
    return c.json({
      status: row.status,
      phoneE164: row.phoneE164,
      connectedAt: row.connectedAt,
      throttleMode: row.throttleMode,
      customRatePerMin: row.customRatePerMin,
      dailyCap: row.dailyCap,
      coldPolicy: row.coldPolicy,
      acknowledgedAt: row.acknowledgedAt,
      bannedSuspectedAt: row.bannedSuspectedAt,
    });
  })
  /**
   * Baileys connect — records acknowledgments, flips provider, triggers the
   * worker to open a fresh socket. QR arrives over the SSE stream below.
   */
  .post("/whatsapp/baileys/connect", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    baileysConnectSchema.parse(await c.req.json());

    // Upsert the session row with acknowledgment stamp + defaults.
    await db.execute(
      sql`INSERT INTO wa_baileys_sessions (org_id, status, acknowledged_at, updated_at)
          VALUES (${orgId}, 'pending', now(), now())
          ON CONFLICT (org_id) DO UPDATE
             SET acknowledged_at = EXCLUDED.acknowledged_at,
                 updated_at = EXCLUDED.updated_at,
                 status = 'pending',
                 creds = NULL,
                 phone_e164 = NULL,
                 connected_at = NULL,
                 banned_suspected_at = NULL`,
    );
    await db
      .update(settings)
      .set({ waProvider: "baileys", updatedAt: new Date() })
      .where(eq(settings.orgId, orgId));

    await redis.publish(
      WA_CONTROL_CHANNEL,
      JSON.stringify({ kind: "baileys.pair", orgId }),
    );

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "whatsapp.baileys.pair_started",
      target: orgId,
      metadata: {},
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return c.json({ ok: true, streamUrl: "/api/settings/whatsapp/baileys/events" });
  })
  /**
   * SSE stream of pairing events. Carries: connecting / qr / connected /
   * logged_out / failed. Subscribes to the worker's wa:pair:{orgId} channel.
   */
  .get("/whatsapp/baileys/events", async (c) => {
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }

    return streamSSE(c, async (stream) => {
      const channel = baileysPairChannel(orgId);
      const sub = subRedis.duplicate();
      await sub.subscribe(channel);

      // Initial snapshot so late-joining clients see current state.
      const db = c.var.db;
      const [row] = await db
        .select()
        .from(waBaileysSessions)
        .where(eq(waBaileysSessions.orgId, orgId));
      await stream.writeSSE({
        event: "snapshot",
        data: JSON.stringify({
          type: "snapshot",
          status: row?.status ?? "none",
          phoneE164: row?.phoneE164 ?? null,
        }),
      });

      const handler = (_: string, payload: string) => {
        stream.writeSSE({ event: "update", data: payload }).catch(() => {});
      };
      sub.on("message", handler);

      const ping = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "1" }).catch(() => {});
      }, 15000);

      stream.onAbort(async () => {
        clearInterval(ping);
        await sub.unsubscribe(channel);
        await sub.quit();
      });

      await new Promise<void>((resolve) => stream.onAbort(resolve));
    });
  })
  .post("/whatsapp/baileys/disconnect", async (c) => {
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    await redis.publish(
      WA_CONTROL_CHANNEL,
      JSON.stringify({ kind: "baileys.disconnect", orgId }),
    );

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "whatsapp.baileys.disconnected",
      target: orgId,
      metadata: {},
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return c.json({ ok: true });
  })
  /** Per-org Baileys safety knobs (throttle / daily cap / cold policy). */
  .patch("/whatsapp/baileys/safety", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = baileysSafetySchema.parse(await c.req.json());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.throttleMode) patch.throttleMode = body.throttleMode;
    if (body.customRatePerMin !== undefined) patch.customRatePerMin = body.customRatePerMin;
    if (body.dailyCap) patch.dailyCap = body.dailyCap;
    if (body.coldPolicy) patch.coldPolicy = body.coldPolicy;
    const [row] = await db
      .update(waBaileysSessions)
      .set(patch)
      .where(eq(waBaileysSessions.orgId, orgId))
      .returning();
    if (!row) return c.json({ error: "not_connected" }, 404);
    return c.json(row);
  });
