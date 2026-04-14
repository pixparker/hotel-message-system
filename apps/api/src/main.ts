import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { log } from "./log.js";
import { handleError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { guestRoutes } from "./routes/guests.js";
import { templateRoutes } from "./routes/templates.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { sseRoutes } from "./routes/sse.js";
import { settingsRoutes } from "./routes/settings.js";
import { webhookRoutes } from "./routes/webhooks.js";

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

app.get("/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/guests", guestRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/campaigns", campaignRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api", sseRoutes); // mounts /campaigns/:id/events

app.onError(handleError);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  log.info(`api listening on :${info.port}`);
});
