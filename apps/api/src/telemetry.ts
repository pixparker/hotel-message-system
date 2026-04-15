import * as Sentry from "@sentry/node";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "./env.js";
import { log } from "./log.js";

/**
 * Initialize Sentry if DSN is configured. Called from main.ts before any
 * request handlers run. No-op if SENTRY_DSN is missing — convenient for
 * local dev where we don't want every crash paged.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    log.info("Sentry not configured (SENTRY_DSN missing) — errors logged via pino only");
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Don't include the request body in error payloads — it may contain
    // tokens, passwords, or other secrets we never want in a third-party
    // error tracker.
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.nodeContextIntegration()],
  });
  log.info({ environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV }, "Sentry initialized");
}

/**
 * Hono middleware that tags the Sentry scope with organization_id + user_id
 * from the auth context, so every error sent to Sentry has tenant context.
 */
export const sentryContextMiddleware: MiddlewareHandler = async (c, next) => {
  if (!env.SENTRY_DSN) {
    return next();
  }
  const claims = c.get("auth") as { orgId?: string; sub?: string } | undefined;
  if (claims) {
    Sentry.setTag("organization_id", claims.orgId ?? "anonymous");
    Sentry.setUser({ id: claims.sub });
  }
  return next();
};

/**
 * Capture an unhandled Hono error to Sentry. Called from the app.onError
 * handler before it returns the JSON error response to the client.
 */
export function captureError(err: Error, c: Context): void {
  if (!env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag("method", c.req.method);
    scope.setTag("path", new URL(c.req.url).pathname);
    Sentry.captureException(err);
  });
}

/** Clean shutdown — flush any queued events. */
export async function shutdownTelemetry(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  await Sentry.close(2000);
}
