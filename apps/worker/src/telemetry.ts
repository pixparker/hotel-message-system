import * as Sentry from "@sentry/node";
import { env } from "./env.js";

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
  });
}

export function captureWorkerError(err: Error, tags: Record<string, string>): void {
  if (!env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    Object.entries(tags).forEach(([k, v]) => scope.setTag(k, v));
    Sentry.captureException(err);
  });
}

export async function shutdownTelemetry(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  await Sentry.close(2000);
}
