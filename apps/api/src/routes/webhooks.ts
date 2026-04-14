import { Hono } from "hono";
import { getDb, webhookEvents } from "@hms/db";
import { env } from "../env.js";

const db = getDb();

/**
 * Cloud API webhook receiver. Stores raw payloads for the worker to process.
 * GET handles the Meta verification handshake.
 */
export const webhookRoutes = new Hono()
  .get("/whatsapp", (c) => {
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
    const payload = await c.req.json().catch(() => ({}));
    await db.insert(webhookEvents).values({ provider: "cloud", payload });
    // M2: publish to a processing queue so the worker updates message status.
    return c.json({ ok: true });
  });
