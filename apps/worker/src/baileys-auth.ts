import { sql } from "drizzle-orm";
import type { Db } from "@hms/db";
import { waBaileysKeys, waBaileysSessions } from "@hms/db";
import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
  type SignalKeyStore,
} from "@whiskeysockets/baileys";
import { encryptBytes, decryptBytes } from "./crypto.js";

/**
 * Build a Baileys AuthenticationState backed by Postgres. Matches the shape of
 * Baileys' own `useMultiFileAuthState` helper so call sites are symmetric:
 *
 *   const { state, saveCreds } = await buildBaileysDeps(db, orgId);
 *   const sock = makeWASocket({ auth: state });
 *   sock.ev.on("creds.update", saveCreds);
 *
 * All writes (creds + key material) are encrypted with SECRETS_ENCRYPTION_KEY
 * before hitting bytea columns. RLS is enforced by pinning the tenant session
 * variable inside each transaction.
 */
export async function buildBaileysDeps(
  db: Db,
  orgId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  // Load (or init) creds.
  const existing = await loadSessionCreds(db, orgId);
  const creds: AuthenticationCreds = existing ?? initAuthCreds();

  // If this is a brand-new session, make sure a row exists so subsequent
  // saveCreds() updates don't silently no-op on an UPDATE without WHERE match.
  if (!existing) {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_org', ${orgId}, true)`,
      );
      await tx.execute(
        sql`INSERT INTO wa_baileys_sessions (org_id, status) VALUES (${orgId}, 'pending')
            ON CONFLICT (org_id) DO NOTHING`,
      );
    });
  }

  const keys: SignalKeyStore = {
    async get(type, ids) {
      return withTenant(db, orgId, async (tx) => {
        const out: Record<string, SignalDataTypeMap[typeof type]> = {};
        if (ids.length === 0) return out;
        const rows = (await tx.execute(
          sql`SELECT key_id, value FROM wa_baileys_keys
              WHERE org_id = ${orgId}
                AND key_type = ${type}
                AND key_id = ANY(${ids})`,
        )) as unknown as Array<{ key_id: string; value: Buffer }>;
        for (const row of rows) {
          const decrypted = decryptBytes(row.value);
          const parsed = JSON.parse(decrypted.toString("utf8"), BufferJSON.reviver);
          out[row.key_id] = parsed as SignalDataTypeMap[typeof type];
        }
        return out;
      });
    },

    async set(data) {
      // Baileys calls .set() in bursts during key rotation. Batch every type's
      // writes into a single transaction so a mid-rotation crash either
      // commits fully or not at all.
      await withTenant(db, orgId, async (tx) => {
        for (const type of Object.keys(data) as Array<keyof typeof data>) {
          const bucket = data[type];
          if (!bucket) continue;
          for (const [id, value] of Object.entries(bucket)) {
            if (value === null || value === undefined) {
              await tx
                .delete(waBaileysKeys)
                .where(
                  sql`${waBaileysKeys.orgId} = ${orgId}
                      AND ${waBaileysKeys.keyType} = ${type}
                      AND ${waBaileysKeys.keyId} = ${id}`,
                );
            } else {
              const encoded = JSON.stringify(value, BufferJSON.replacer);
              const encrypted = encryptBytes(Buffer.from(encoded, "utf8"));
              await tx.execute(
                sql`INSERT INTO wa_baileys_keys (org_id, key_type, key_id, value, updated_at)
                    VALUES (${orgId}, ${type}, ${id}, ${encrypted}, now())
                    ON CONFLICT (org_id, key_type, key_id)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
              );
            }
          }
        }
      });
    },
  };

  const saveCreds = async () => {
    const encoded = JSON.stringify(creds, BufferJSON.replacer);
    const encrypted = encryptBytes(Buffer.from(encoded, "utf8"));
    await withTenant(db, orgId, async (tx) => {
      await tx.execute(
        sql`UPDATE wa_baileys_sessions
               SET creds = ${encrypted}, updated_at = now()
             WHERE org_id = ${orgId}`,
      );
    });
  };

  return { state: { creds, keys }, saveCreds };
}

// ---------------------------------------------------------------------------

async function loadSessionCreds(
  db: Db,
  orgId: string,
): Promise<AuthenticationCreds | null> {
  // We use the SECURITY DEFINER helper so the initial load works even before
  // we've set a tenant context on the connection. The helper is read-only and
  // org-scoped via its argument.
  const rows = (await db.execute(
    sql`SELECT creds FROM baileys_load_session(${orgId})`,
  )) as unknown as Array<{ creds: Buffer | null }>;
  const raw = rows[0]?.creds;
  if (!raw) return null;
  const plaintext = decryptBytes(raw).toString("utf8");
  return JSON.parse(plaintext, BufferJSON.reviver) as AuthenticationCreds;
}

async function withTenant<T>(
  db: Db,
  orgId: string,
  fn: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Mark a session connected — called from the control listener when Baileys
 * emits `connection: "open"` with a populated `sock.user.id`.
 */
export async function markSessionConnected(
  db: Db,
  orgId: string,
  phoneE164: string,
): Promise<void> {
  await withTenant(db, orgId, async (tx) => {
    await tx
      .update(waBaileysSessions)
      .set({
        status: "connected",
        phoneE164,
        connectedAt: new Date(),
        bannedSuspectedAt: null,
        updatedAt: new Date(),
      })
      .where(sql`${waBaileysSessions.orgId} = ${orgId}`);
  });
}

/** WhatsApp kicked the linked device off. Flag it so UI can surface a banner. */
export async function markSessionLoggedOut(
  db: Db,
  orgId: string,
): Promise<void> {
  await withTenant(db, orgId, async (tx) => {
    await tx
      .update(waBaileysSessions)
      .set({
        status: "logged_out",
        bannedSuspectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${waBaileysSessions.orgId} = ${orgId}`);
  });
}

export async function markSessionFailed(
  db: Db,
  orgId: string,
): Promise<void> {
  await withTenant(db, orgId, async (tx) => {
    await tx
      .update(waBaileysSessions)
      .set({ status: "failed", updatedAt: new Date() })
      .where(sql`${waBaileysSessions.orgId} = ${orgId}`);
  });
}

/**
 * Wipe all key material + creds for this org. Called on manual disconnect or
 * before a re-pair so we never reuse half-dead credentials.
 */
export async function clearSession(db: Db, orgId: string): Promise<void> {
  await withTenant(db, orgId, async (tx) => {
    await tx
      .delete(waBaileysKeys)
      .where(sql`${waBaileysKeys.orgId} = ${orgId}`);
    await tx
      .update(waBaileysSessions)
      .set({
        creds: null,
        status: "pending",
        phoneE164: null,
        connectedAt: null,
        bannedSuspectedAt: null,
        updatedAt: new Date(),
      })
      .where(sql`${waBaileysSessions.orgId} = ${orgId}`);
  });
}

export interface SessionSnapshot {
  orgId: string;
  status: "pending" | "connected" | "logged_out" | "failed";
  phoneE164: string | null;
  connectedAt: Date | null;
  throttleMode: "careful" | "balanced" | "custom";
  customRatePerMin: number | null;
  dailyCap: number;
  coldPolicy: "warn" | "block" | "allow";
  acknowledgedAt: Date | null;
  bannedSuspectedAt: Date | null;
}

export async function loadSessionSnapshot(
  db: Db,
  orgId: string,
): Promise<SessionSnapshot | null> {
  const rows = (await db.execute(
    sql`SELECT org_id, status, phone_e164, connected_at,
               throttle_mode, custom_rate_per_min, daily_cap, cold_policy,
               acknowledged_at, banned_suspected_at
          FROM baileys_load_session(${orgId})`,
  )) as unknown as Array<{
    org_id: string;
    status: string;
    phone_e164: string | null;
    connected_at: string | null;
    throttle_mode: string;
    custom_rate_per_min: number | null;
    daily_cap: number;
    cold_policy: string;
    acknowledged_at: string | null;
    banned_suspected_at: string | null;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    orgId: r.org_id,
    status: r.status as SessionSnapshot["status"],
    phoneE164: r.phone_e164,
    connectedAt: r.connected_at ? new Date(r.connected_at) : null,
    throttleMode: r.throttle_mode as SessionSnapshot["throttleMode"],
    customRatePerMin: r.custom_rate_per_min,
    dailyCap: r.daily_cap,
    coldPolicy: r.cold_policy as SessionSnapshot["coldPolicy"],
    acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at) : null,
    bannedSuspectedAt: r.banned_suspected_at ? new Date(r.banned_suspected_at) : null,
  };
}

export async function listConnectedOrgs(db: Db): Promise<string[]> {
  const rows = (await db.execute(
    sql`SELECT org_id FROM baileys_list_connected_orgs()`,
  )) as unknown as Array<{ org_id: string }>;
  return rows.map((r) => r.org_id);
}

export async function upsertInboundTouch(
  db: Db,
  orgId: string,
  fromE164: string,
  at: Date,
): Promise<void> {
  await withTenant(db, orgId, async (tx) => {
    await tx.execute(
      sql`INSERT INTO wa_inbound_touches (org_id, from_e164, first_at, last_at, count)
          VALUES (${orgId}, ${fromE164}, ${at}, ${at}, 1)
          ON CONFLICT (org_id, from_e164)
          DO UPDATE SET last_at = EXCLUDED.last_at, count = wa_inbound_touches.count + 1`,
    );
  });
}
