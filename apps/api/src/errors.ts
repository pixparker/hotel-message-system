import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { log } from "./log.js";
import { captureError } from "./telemetry.js";

export function handleError(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: "validation_error", issues: err.issues }, 400);
  }
  log.error({ err }, "unhandled error");
  // Only unhandled errors go to Sentry — client errors (4xx) aren't paged.
  captureError(err, c);
  return c.json({ error: "internal_error" }, 500);
}
