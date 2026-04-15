import type { Context } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "@hms/db";
import { log } from "./log.js";

const db = getDb();

export interface AuditEntry {
  /** Tenant id; null for pre-tenant events (failed login with unknown email, etc.). */
  orgId?: string | null;
  /** Actor user id; null for anonymous events. */
  userId?: string | null;
  /** Short action name: "auth.login", "campaign.create", "settings.update", ... */
  action: string;
  /** Resource target id (campaign id, user id, etc.). */
  target?: string | null;
  /** Free-form JSON metadata. Keep it small. */
  metadata?: Record<string, unknown>;
  /** Remote IP (best effort). */
  ip?: string | null;
  /** User-Agent header. */
  userAgent?: string | null;
}

/**
 * Best-effort audit log write. Never throws — audit failures must not break
 * business flows. Errors are logged via pino for operator visibility.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.execute(
      sql`SELECT audit_log_event(
        ${entry.orgId ?? null}::uuid,
        ${entry.userId ?? null}::uuid,
        ${entry.action},
        ${entry.target ?? null},
        ${JSON.stringify(entry.metadata ?? {})}::jsonb,
        ${entry.ip ?? null},
        ${entry.userAgent ?? null}
      )`,
    );
  } catch (err) {
    log.warn({ err, action: entry.action }, "audit log write failed");
  }
}

/** Pull the best-effort client IP + user agent from a request. */
export function auditContext(c: Context): { ip: string | null; userAgent: string | null } {
  const xff = c.req.header("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
  const userAgent = c.req.header("user-agent") ?? null;
  return { ip, userAgent };
}
