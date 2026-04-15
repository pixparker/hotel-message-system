import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { settings } from "@hms/db";
import { settingsUpdateSchema, normalizePhone } from "@hms/shared";
import { CloudWaDriver } from "@hms/wa-driver";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";
import { auditLog, auditContext } from "../audit.js";
import { encryptSecret } from "../crypto.js";

const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  appSecret: z.string().min(1),
  testPhone: z.string().min(1),
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
    const [row] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.orgId, orgId))
      .returning();

    const ctx = auditContext(c);
    // Audit without leaking the appSecret: only record which keys changed.
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
   * Guided WhatsApp connect wizard backend.
   * 1. Validate credentials
   * 2. Send a test message to the admin's phone to verify the tokens work
   * 3. Only on success, persist encrypted access token + app secret
   * 4. Flip waProvider to "cloud"
   */
  .post("/whatsapp/connect", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    if (c.get("auth").role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = connectWhatsAppSchema.parse(await c.req.json());

    // Test send using the provided credentials (not yet persisted).
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

    // Test succeeded — encrypt the tokens and persist.
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
  });
