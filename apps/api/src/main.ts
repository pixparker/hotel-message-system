import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { log } from "./log.js";
import { handleError } from "./errors.js";
import { initSentry, sentryContextMiddleware } from "./telemetry.js";

initSentry();
import { sendMessageQueue, redis } from "./redis.js";
import { getDb } from "@hms/db";
import { sql } from "drizzle-orm";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { contactRoutes } from "./routes/contacts.js";
import { audienceRoutes } from "./routes/audiences.js";
import { tagRoutes } from "./routes/tags.js";
import { templateRoutes } from "./routes/templates.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { sseRoutes } from "./routes/sse.js";
import { settingsRoutes } from "./routes/settings.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { statsRoutes } from "./routes/stats.js";
import { auditRoutes } from "./routes/audit.js";

const app = new Hono();

app.use("*", logger((msg) => log.info(msg)));
app.use(
  "*",
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use("*", sentryContextMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * /health/deep — used by uptime monitors and on-call. Checks DB + Redis + worker
 * queue depth. Returns 503 if any check fails so the uptime monitor can page.
 */
const healthDb = getDb();
app.get("/health/deep", async (c) => {
  const checks: Record<string, unknown> = {};
  let ok = true;

  // DB reachable + round-trippable
  try {
    const start = Date.now();
    await healthDb.execute(sql`SELECT 1`);
    checks.db = { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    ok = false;
    checks.db = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Redis reachable
  try {
    const start = Date.now();
    await redis.ping();
    checks.redis = { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    ok = false;
    checks.redis = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Queue depth — excessive backlog is a page-worthy condition.
  try {
    const counts = await sendMessageQueue.getJobCounts("waiting", "active", "delayed", "failed");
    checks.queue = counts;
    if ((counts.waiting ?? 0) > 10_000) ok = false;
  } catch (err) {
    ok = false;
    checks.queue = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return c.json({ ok, checks }, ok ? 200 : 503);
});
app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/contacts", contactRoutes);
app.route("/api/audiences", audienceRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/campaigns", campaignRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api", sseRoutes); // mounts /campaigns/:id/events

app.onError(handleError);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  log.info(`api listening on :${info.port}`);
});
