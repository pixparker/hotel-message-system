import type { Redis as IORedis } from "ioredis";
import type { Logger } from "pino";
import type { Db } from "@hms/db";
import type { WaDriver } from "@hms/wa-driver";
import { createDriver, BaileysWaDriver } from "@hms/wa-driver";
import {
  buildBaileysDeps,
  clearSession,
  listConnectedOrgs,
  markSessionConnected,
  markSessionFailed,
  markSessionLoggedOut,
  upsertInboundTouch,
} from "./baileys-auth.js";

export const WA_CONTROL_CHANNEL = "wa:control";
export const baileysPairChannel = (orgId: string): string => `wa:pair:${orgId}`;

export type ControlCommand =
  | { kind: "baileys.pair"; orgId: string }
  | { kind: "baileys.disconnect"; orgId: string }
  | { kind: "baileys.reconnect"; orgId: string };

export interface BaileysControlDeps {
  db: Db;
  /** Publisher — Redis connection used to send events to the UI (SSE). */
  pub: IORedis;
  /** Subscriber — Redis connection used to listen for control commands. */
  sub: IORedis;
  log: Logger;
  /** Called whenever a fresh BaileysWaDriver is ready to serve sends. */
  onDriverReady: (orgId: string, driver: WaDriver) => void;
  /** Called whenever a driver should be removed (disconnect/logout/reset). */
  onDriverEvicted: (orgId: string) => Promise<void>;
}

/**
 * Subscribes to the `wa:control` channel and orchestrates Baileys session
 * pairing and lifecycle. Runs in the worker process exactly once at boot.
 *
 * On boot it also eagerly rehydrates already-connected sessions so sends
 * don't need a QR round-trip after a worker restart.
 */
export async function startBaileysControlListener(
  deps: BaileysControlDeps,
): Promise<void> {
  const { sub, log } = deps;
  await sub.subscribe(WA_CONTROL_CHANNEL);

  sub.on("message", async (channel, raw) => {
    if (channel !== WA_CONTROL_CHANNEL) return;
    let cmd: ControlCommand | null = null;
    try {
      cmd = JSON.parse(raw);
    } catch {
      log.warn({ raw }, "baileys-control: malformed message");
      return;
    }
    if (!cmd) return;
    try {
      switch (cmd.kind) {
        case "baileys.pair":
          await handlePair(deps, cmd.orgId);
          break;
        case "baileys.disconnect":
          await handleDisconnect(deps, cmd.orgId);
          break;
        case "baileys.reconnect":
          await handleReconnect(deps, cmd.orgId);
          break;
      }
    } catch (err) {
      log.error({ err, cmd }, "baileys-control: command failed");
    }
  });

  // Eagerly re-open sockets for already-connected sessions so the worker
  // restart doesn't force every tenant to re-scan. Stagger the opens to avoid
  // a deploy-time reconnect storm WA might interpret as abuse.
  rehydrateConnectedSessions(deps).catch((err) => {
    log.error({ err }, "baileys-control: rehydrate failed");
  });

  log.info("baileys-control listener started");
}

async function rehydrateConnectedSessions(deps: BaileysControlDeps): Promise<void> {
  const orgIds = await listConnectedOrgs(deps.db);
  for (const orgId of orgIds) {
    const jitter = Math.floor(Math.random() * 30_000);
    setTimeout(() => {
      openSessionForOrg(deps, orgId, { fresh: false }).catch((err) => {
        deps.log.error({ err, orgId }, "baileys-control: rehydrate open failed");
      });
    }, jitter);
  }
  if (orgIds.length > 0) {
    deps.log.info(
      { count: orgIds.length },
      "baileys-control: rehydrating sessions (staggered 0-30s)",
    );
  }
}

/**
 * Create a BaileysWaDriver for an org. If `fresh`, wipe any prior session so
 * we start from a clean QR pair. Otherwise, resume with whatever creds are
 * on disk.
 */
async function openSessionForOrg(
  deps: BaileysControlDeps,
  orgId: string,
  opts: { fresh: boolean },
): Promise<void> {
  const { db, pub, log } = deps;
  if (opts.fresh) {
    await clearSession(db, orgId);
  }
  await deps.onDriverEvicted(orgId);

  const { state, saveCreds } = await buildBaileysDeps(db, orgId);

  const driver = createDriver("baileys", {
    baileys: {
      orgId,
      authState: state,
      saveCreds,
      onPairingEvent: (e) => {
        // Forward QR + status updates to the SSE stream.
        pub.publish(baileysPairChannel(orgId), JSON.stringify(e)).catch(() => {});
        // Async side effects on major transitions:
        if (e.type === "connected") {
          markSessionConnected(db, orgId, e.phoneE164).catch((err) =>
            log.error({ err, orgId }, "markSessionConnected failed"),
          );
        } else if (e.type === "logged_out") {
          markSessionLoggedOut(db, orgId).catch((err) =>
            log.error({ err, orgId }, "markSessionLoggedOut failed"),
          );
        } else if (e.type === "failed") {
          markSessionFailed(db, orgId).catch((err) =>
            log.error({ err, orgId }, "markSessionFailed failed"),
          );
        }
      },
      onSessionLoggedOut: async () => {
        await deps.onDriverEvicted(orgId);
      },
      onInboundTouch: async (fromE164, at) => {
        await upsertInboundTouch(db, orgId, fromE164, at).catch(() => {
          /* best-effort, never blocks inbound */
        });
      },
    },
  });

  // `driver` is concretely a BaileysWaDriver; open the socket before handing
  // it to the worker. If the open throws, the driver never enters the cache.
  if (driver instanceof BaileysWaDriver) {
    await driver.connect();
  }
  deps.onDriverReady(orgId, driver);
}

async function handlePair(deps: BaileysControlDeps, orgId: string): Promise<void> {
  await openSessionForOrg(deps, orgId, { fresh: true });
}

async function handleDisconnect(deps: BaileysControlDeps, orgId: string): Promise<void> {
  await deps.onDriverEvicted(orgId);
  await clearSession(deps.db, orgId);
  await deps.pub.publish(
    baileysPairChannel(orgId),
    JSON.stringify({ type: "logged_out" }),
  );
}

async function handleReconnect(deps: BaileysControlDeps, orgId: string): Promise<void> {
  await openSessionForOrg(deps, orgId, { fresh: false });
}

/** Convenience for callers that publish control commands. */
export function encodeControlCommand(cmd: ControlCommand): string {
  return JSON.stringify(cmd);
}
