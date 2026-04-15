import type { Context, MiddlewareHandler } from "hono";
import { sql } from "drizzle-orm";
import { getDb, type Db } from "@hms/db";

const rootDb = getDb();

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type TenantDb = Tx;

declare module "hono" {
  interface ContextVariableMap {
    db: TenantDb;
  }
}

/**
 * Opens a Postgres transaction pinned to the caller's org and exposes the
 * transactional Drizzle handle as `c.var.db`. Every query made inside the
 * handler chain is automatically scoped by Row-Level Security policies.
 *
 * Mount AFTER requireAuth — we read orgId from the auth claims.
 */
export const withTenant: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  if (!auth?.orgId) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await rootDb.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org', ${auth.orgId}, true)`,
    );
    c.set("db", tx);
    await next();
  });
};

/**
 * For callers that need to run a single query outside of a middleware chain
 * (e.g. worker jobs, CLI scripts). Opens a transaction, sets the tenant
 * context, runs `fn`, commits. Rolls back on throw.
 */
export async function runAsTenant<T>(
  orgId: string,
  fn: (tx: TenantDb) => Promise<T>,
): Promise<T> {
  return rootDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org', ${orgId}, true)`);
    return fn(tx);
  });
}

/** Escape hatch for requests that legitimately run without a tenant (login, webhooks). */
export function rootConnection(): Db {
  return rootDb;
}

export function currentDb(c: Context): TenantDb {
  const db = c.get("db");
  if (!db) throw new Error("withTenant middleware not applied to this route");
  return db;
}
