import { Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import pino from "pino";
import { eq, sql } from "drizzle-orm";
import { getDb, messages, campaigns, settings } from "@hms/db";
import {
  createDriver,
  CloudWaDriver,
  type WaDriver,
  type ProviderName,
} from "@hms/wa-driver";
import { env } from "./env.js";
import { decryptSecret } from "./crypto.js";
import { initSentry, captureWorkerError } from "./telemetry.js";
import {
  startBaileysControlListener,
  baileysPairChannel,
} from "./baileys-control.js";
import {
  buildBaileysDeps,
  loadSessionSnapshot,
  type SessionSnapshot,
} from "./baileys-auth.js";

initSentry();

const log = pino({ name: "worker", level: env.LOG_LEVEL });
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const pub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const webhookSub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const controlSub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const db = getDb(env.DATABASE_URL);

// Per-tenant driver cache. Mock driver is a singleton; Cloud/Baileys are per-org.
// Cached sessions are keyed by orgId + a snapshot of the settings.updated_at so
// a provider switch or re-pair invalidates the cache automatically.
interface CachedDriver {
  driver: WaDriver;
  provider: ProviderName;
  key: string;
  session?: SessionSnapshot | null;
}
const driverCache = new Map<string, CachedDriver>();
const mockDriver = createDriver("mock");

// Per-org mutex for driver construction. Baileys sockets are long-lived and
// expensive — and WhatsApp kicks us with `conflict replaced` if we open two
// sockets for the same creds. When many BullMQ jobs fire at once on a cache
// miss, they'd all race to build a driver. Cache the build promise.
const pendingDrivers = new Map<string, Promise<WaDriver>>();

// Rolling failure tracker for the Baileys circuit breaker.
// key: orgId → { successes, failures, resetAt }
interface FailureWindow {
  successes: number;
  failures: number;
  resetAt: number;
}
const failureWindows = new Map<string, FailureWindow>();
const FAILURE_WINDOW_MS = 30 * 60 * 1000;
const FAILURE_WINDOW_MIN_SAMPLES = 10;
const FAILURE_WINDOW_THRESHOLD = 0.2;

function recordOutcome(orgId: string, ok: boolean) {
  const now = Date.now();
  let w = failureWindows.get(orgId);
  if (!w || w.resetAt < now) {
    w = { successes: 0, failures: 0, resetAt: now + FAILURE_WINDOW_MS };
    failureWindows.set(orgId, w);
  }
  if (ok) w.successes += 1;
  else w.failures += 1;
  return w;
}

function tripCircuitBreaker(w: FailureWindow): boolean {
  const total = w.successes + w.failures;
  if (total < FAILURE_WINDOW_MIN_SAMPLES) return false;
  return w.failures / total >= FAILURE_WINDOW_THRESHOLD;
}

async function settingsKey(orgId: string): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.orgId, orgId));
  return row ? `${row.waProvider}:${row.updatedAt?.getTime() ?? 0}` : "mock:0";
}

async function evictDriverForOrg(orgId: string): Promise<void> {
  const cached = driverCache.get(orgId);
  if (!cached) return;
  driverCache.delete(orgId);
  if (cached.driver.close) {
    try {
      await cached.driver.close();
    } catch (err) {
      log.warn({ err, orgId }, "driver close failed");
    }
  }
}

async function getDriverForOrg(orgId: string): Promise<WaDriver> {
  const nextKey = await settingsKey(orgId);
  const cached = driverCache.get(orgId);
  if (cached && cached.key === nextKey) return cached.driver;

  // Serialize concurrent builds per org. Multiple BullMQ jobs hitting a cache
  // miss at the same time would otherwise each build + connect a driver —
  // Baileys would open two WebSockets with the same creds and WA kicks one.
  const inflight = pendingDrivers.get(orgId);
  if (inflight) return inflight;

  const build = (async (): Promise<WaDriver> => {
    const currentKey = await settingsKey(orgId);
    const stillCached = driverCache.get(orgId);
    if (stillCached && stillCached.key === currentKey) return stillCached.driver;
    if (stillCached) await evictDriverForOrg(orgId);

    const [row] = await db.select().from(settings).where(eq(settings.orgId, orgId));
    const provider: ProviderName =
      (row?.waProvider as ProviderName) ?? env.WA_PROVIDER;

    if (provider === "mock") {
      driverCache.set(orgId, { driver: mockDriver, provider, key: currentKey });
      return mockDriver;
    }

    if (provider === "cloud") {
      const cfg = (row?.waConfig ?? {}) as {
        accessToken?: string;
        phoneNumberId?: string;
      };
      if (!cfg.accessToken || !cfg.phoneNumberId) {
        throw new Error(`cloud driver missing credentials for org ${orgId}`);
      }
      const accessToken = decryptSecret(cfg.accessToken);
      const drv = createDriver("cloud", {
        cloud: { accessToken, phoneNumberId: cfg.phoneNumberId },
      });
      wireStatusHandler(drv);
      driverCache.set(orgId, { driver: drv, provider, key: currentKey });
      return drv;
    }

    if (provider === "baileys") {
      const session = await loadSessionSnapshot(db, orgId);
      if (!session || session.status !== "connected" || !session.phoneE164) {
        throw new Error(`baileys driver not connected for org ${orgId}`);
      }
      const { state, saveCreds } = await buildBaileysDeps(db, orgId);
      const drv = createDriver("baileys", {
        baileys: {
          orgId,
          authState: state,
          saveCreds,
          onPairingEvent: (e) => {
            pub.publish(baileysPairChannel(orgId), JSON.stringify(e)).catch(() => {});
          },
        },
      });
      const anyDrv = drv as WaDriver & { connect?: () => Promise<void> };
      if (anyDrv.connect) await anyDrv.connect();
      wireStatusHandler(drv);
      driverCache.set(orgId, { driver: drv, provider, key: currentKey, session });
      return drv;
    }

    throw new Error(`unsupported provider ${provider}`);
  })();

  pendingDrivers.set(orgId, build);
  try {
    return await build;
  } finally {
    pendingDrivers.delete(orgId);
  }
}

// Map providerMessageId → {orgId, campaignId, messageId} so status callbacks
// can re-establish the tenant context before touching RLS-protected tables.
const inflight = new Map<
  string,
  { orgId: string; messageId: string; campaignId: string }
>();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function asTenant<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org', ${orgId}, true)`);
    return fn(tx);
  });
}

/** Resolve orgId for a provider status event using the RLS-bypass lookup. */
async function orgIdForMessage(messageId: string): Promise<string | null> {
  const rows = (await db.execute(
    sql`SELECT worker_org_for_message(${messageId}) AS org_id`,
  )) as unknown as Array<{ org_id: string | null }>;
  return rows[0]?.org_id ?? null;
}

function wireStatusHandler(d: WaDriver) {
  d.onStatus(onStatusEvent);
}

wireStatusHandler(mockDriver);

// Subscribe to webhook pub/sub so verified Meta Cloud payloads are
// dispatched into the per-tenant driver → worker status pipeline.
webhookSub.subscribe("wa:webhook").catch((err) => {
  log.error({ err }, "failed to subscribe to wa:webhook");
});
webhookSub.on("message", async (_, raw) => {
  try {
    const { orgId, payload } = JSON.parse(raw) as {
      orgId: string;
      payload: unknown;
    };
    const d = await getDriverForOrg(orgId);
    if (d instanceof CloudWaDriver) {
      d.handleWebhook(payload);
    }
  } catch (err) {
    log.error({ err }, "failed to process wa:webhook message");
  }
});

// Ordered progression for outbound messages. "failed" is only a valid
// transition from "queued" / (not yet in any positive state). A later "failed"
// event must never overwrite a successful ack — providers occasionally emit
// spurious error events for messages that actually delivered.
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  failed: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

async function onStatusEvent(e: import("@hms/wa-driver").StatusEvent) {
  const ref = inflight.get(e.providerMessageId);
  if (!ref) return;
  const { orgId } = ref;

  const applied = await asTenant(orgId, async (tx) => {
    const [current] = await tx
      .select({ status: messages.status })
      .from(messages)
      .where(eq(messages.id, ref!.messageId));
    if (!current) return false;

    const currentRank = STATUS_RANK[current.status] ?? 0;
    const nextRank = STATUS_RANK[e.status] ?? 0;

    // Idempotent + monotonic: skip equal or lower statuses. This drops
    // duplicate ACKs and refuses to demote a delivered/read message to failed.
    if (nextRank <= currentRank) return false;

    const now = e.at ?? new Date();
    const patch: Record<string, unknown> = { status: e.status };
    if (e.status === "delivered") patch.deliveredAt = now;
    if (e.status === "read") patch.readAt = now;
    if (e.status === "failed") patch.error = e.error ?? "unknown";

    await tx.update(messages).set(patch).where(eq(messages.id, ref!.messageId));

    const counterCol =
      e.status === "delivered"
        ? "totals_delivered"
        : e.status === "read"
          ? "totals_seen"
          : "totals_failed";
    await tx.execute(
      sql`update campaigns set ${sql.raw(counterCol)} = ${sql.raw(counterCol)} + 1 where id = ${ref!.campaignId}`,
    );
    return true;
  });

  if (!applied) return;

  await pub.publish(
    `campaign:${ref.campaignId}`,
    JSON.stringify({
      type: "progress",
      campaignId: ref.campaignId,
      messageId: ref.messageId,
      status: e.status,
    }),
  );

  if (e.status === "read" || e.status === "failed") {
    inflight.delete(e.providerMessageId);
    await maybeFinalizeCampaign(orgId, ref.campaignId);
  }
}

async function maybeFinalizeCampaign(orgId: string, campaignId: string) {
  const done = await asTenant(orgId, async (tx) => {
    const [row] = (await tx.execute(
      sql`select totals_queued, totals_sent, totals_delivered, totals_seen, totals_failed, status
          from campaigns where id = ${campaignId}`,
    )) as unknown as Array<{
      totals_queued: number;
      totals_seen: number;
      totals_failed: number;
      status: string;
    }>;
    if (!row) return false;
    const total = Number(row.totals_queued);
    const complete = Number(row.totals_seen) + Number(row.totals_failed);
    if (complete >= total && row.status === "sending") {
      await tx
        .update(campaigns)
        .set({ status: "done", finishedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
      return true;
    }
    return false;
  });
  if (done) {
    await pub.publish(
      `campaign:${campaignId}`,
      JSON.stringify({ type: "done", campaignId }),
    );
  }
}

/**
 * Provider- and session-age-aware per-org rate limit. Baileys orgs get lower
 * ceilings that widen as the session earns trust; Cloud/Mock use the
 * historical 80/min default (Meta Tier 1). `custom` honors a per-org override.
 */
function baileysRate(session: SessionSnapshot | null | undefined): number {
  if (!session) return env.WORKER_BAILEYS_MSGS_PER_MINUTE_NEW;
  if (session.throttleMode === "custom" && session.customRatePerMin) {
    return Math.min(session.customRatePerMin, 60);
  }
  const connectedAt = session.connectedAt?.getTime() ?? Date.now();
  const ageDays = Math.max(0, (Date.now() - connectedAt) / (1000 * 60 * 60 * 24));
  if (ageDays < 1) return env.WORKER_BAILEYS_MSGS_PER_MINUTE_NEW;
  if (ageDays < 7 || session.throttleMode === "careful") {
    return env.WORKER_BAILEYS_MSGS_PER_MINUTE_WEEK;
  }
  return env.WORKER_BAILEYS_MSGS_PER_MINUTE_STEADY;
}

async function acquireOrgToken(
  orgId: string,
  provider: ProviderName,
  session: SessionSnapshot | null | undefined,
): Promise<boolean> {
  const windowSec = 60;
  const maxPerWindow =
    provider === "baileys" ? baileysRate(session) : Number(env.WORKER_ORG_MSGS_PER_MINUTE ?? 80);
  const key = `worker:rl:${orgId}`;
  const count = await connection.incr(key);
  if (count === 1) {
    await connection.expire(key, windowSec);
  }
  return count <= maxPerWindow;
}

/**
 * Per-day cap: increments a UTC-day key; if over the cap, the job is deferred
 * to the next day rather than failed. Applies to Baileys only for now —
 * Cloud tiers handle rate enforcement themselves.
 */
async function checkDailyCap(
  orgId: string,
  session: SessionSnapshot | null | undefined,
): Promise<{ allowed: boolean; msUntilReset: number }> {
  if (!session) return { allowed: true, msUntilReset: 0 };
  const cap = Math.min(session.dailyCap, 1000);
  const day = new Date().toISOString().slice(0, 10);
  const key = `worker:daily:${orgId}:${day}`;
  const count = await connection.incr(key);
  if (count === 1) {
    // Reset at next UTC midnight.
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const ttl = Math.ceil((next.getTime() - now.getTime()) / 1000);
    await connection.expire(key, ttl);
  }
  if (count <= cap) return { allowed: true, msUntilReset: 0 };
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return { allowed: false, msUntilReset: next.getTime() - now.getTime() };
}

new Worker(
  "send-message",
  async (job) => {
    const { messageId, campaignId, orgId: jobOrgId } = job.data as {
      messageId: string;
      campaignId: string;
      orgId?: string;
    };
    // Pre-RLS jobs enqueued before task 2 won't carry orgId — resolve via the
    // RLS-bypass helper so we don't silently drop in-flight work on deploy.
    const orgId = jobOrgId ?? (await orgIdForMessage(messageId));
    if (!orgId) {
      log.warn({ messageId }, "dropping job: no orgId resolvable");
      return;
    }

    // Resolve (and cache) the driver up front so we can size the rate limit
    // for this org's provider. We also need to know if Baileys is banned
    // before burning a BullMQ attempt.
    const driver = await getDriverForOrg(orgId);
    const cacheEntry = driverCache.get(orgId);
    const provider = cacheEntry?.provider ?? ("mock" as ProviderName);
    const session = cacheEntry?.session ?? null;

    if (provider === "baileys") {
      const snap = session ?? (await loadSessionSnapshot(db, orgId));
      if (snap?.bannedSuspectedAt) {
        log.warn({ orgId, messageId }, "baileys ban suspected; refusing send");
        throw new Error("baileys_ban_suspected");
      }
      // Daily cap check — if over, defer.
      const cap = await checkDailyCap(orgId, snap);
      if (!cap.allowed) {
        await job.moveToDelayed(Date.now() + cap.msUntilReset, job.token);
        throw new Error("daily_cap_reached");
      }
    }

    const allowed = await acquireOrgToken(orgId, provider, session);
    if (!allowed) {
      const delay = 1000 + Math.floor(Math.random() * 4000);
      await job.moveToDelayed(Date.now() + delay, job.token);
      throw new Error("org_rate_limited");
    }

    const result = await asTenant(orgId, async (tx) => {
      const [msg] = await tx.select().from(messages).where(eq(messages.id, messageId));
      if (!msg) return { kind: "skip" as const };

      if (msg.providerMessageId && msg.status !== "queued") {
        log.info({ messageId, status: msg.status }, "skipping already-sent message (idempotency)");
        return { kind: "skip" as const };
      }

      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));
      if (!campaign || campaign.status === "cancelled") return { kind: "skip" as const };

      return { kind: "send" as const, phone: msg.phoneE164, body: msg.renderedBody };
    });

    if (result.kind === "skip") return;

    try {
      const res = await driver.sendText(result.phone, result.body);
      inflight.set(res.providerMessageId, { orgId, messageId, campaignId });
      await asTenant(orgId, async (tx) => {
        await tx
          .update(messages)
          .set({
            status: "sent",
            sentAt: new Date(),
            providerMessageId: res.providerMessageId,
          })
          .where(eq(messages.id, messageId));
        await tx.execute(
          sql`update campaigns set totals_sent = totals_sent + 1 where id = ${campaignId}`,
        );
      });
      await pub.publish(
        `campaign:${campaignId}`,
        JSON.stringify({
          type: "progress",
          campaignId,
          messageId,
          status: "sent",
        }),
      );
      if (provider === "baileys") recordOutcome(orgId, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, messageId }, "send failed");
      if (err instanceof Error) {
        captureWorkerError(err, { orgId, messageId, campaignId });
      }
      await asTenant(orgId, async (tx) => {
        await tx
          .update(messages)
          .set({ status: "failed", error: message })
          .where(eq(messages.id, messageId));
        await tx.execute(
          sql`update campaigns set totals_failed = totals_failed + 1 where id = ${campaignId}`,
        );
      });
      await pub.publish(
        `campaign:${campaignId}`,
        JSON.stringify({
          type: "progress",
          campaignId,
          messageId,
          status: "failed",
        }),
      );
      if (provider === "baileys") {
        const w = recordOutcome(orgId, false);
        if (tripCircuitBreaker(w)) {
          // Pause the campaign so a broken session doesn't burn the remaining
          // recipients. User can resume from the UI once the session is back.
          log.warn({ orgId, campaignId, window: w }, "baileys circuit breaker tripped");
          await asTenant(orgId, async (tx) => {
            await tx
              .update(campaigns)
              .set({ status: "cancelled", finishedAt: new Date() })
              .where(eq(campaigns.id, campaignId));
          });
          await pub.publish(
            baileysPairChannel(orgId),
            JSON.stringify({
              type: "failed",
              reason: `circuit_breaker_${Math.round((w.failures / (w.successes + w.failures)) * 100)}pct`,
            }),
          );
        }
      }
      await maybeFinalizeCampaign(orgId, campaignId);
      throw err;
    }
  },
  { connection, concurrency: 5 },
);

// Kick off the template-approval sync loop (runs every 5 min per tenant).
import { startTemplateSyncLoop } from "./template-sync.js";
startTemplateSyncLoop(db);

// Start the Baileys control listener (pair / disconnect / reconnect).
startBaileysControlListener({
  db,
  pub,
  sub: controlSub,
  log,
  onDriverReady: (orgId, driver) => {
    wireStatusHandler(driver);
    // The control listener just brought up a new Baileys socket. Replace
    // whatever was cached (with the same key generator so cache coherency
    // holds) so subsequent sends use it immediately.
    settingsKey(orgId).then((key) => {
      driverCache.set(orgId, { driver, provider: "baileys", key });
      // Refresh the session snapshot so rate limits see the new connectedAt.
      loadSessionSnapshot(db, orgId)
        .then((snap) => {
          const cached = driverCache.get(orgId);
          if (cached) cached.session = snap;
        })
        .catch(() => {});
    });
  },
  onDriverEvicted: evictDriverForOrg,
  isDriverCached: (orgId) => driverCache.has(orgId) || pendingDrivers.has(orgId),
}).catch((err) => {
  log.error({ err }, "failed to start baileys control listener");
});

// SIGTERM: close every open driver so Baileys WebSockets terminate cleanly.
async function gracefulShutdown(signal: string) {
  log.info({ signal }, "worker shutdown");
  const closes: Promise<void>[] = [];
  for (const [, entry] of driverCache) {
    if (entry.driver.close) {
      closes.push(entry.driver.close().catch(() => {}));
    }
  }
  await Promise.all(closes);
  await connection.quit().catch(() => {});
  await pub.quit().catch(() => {});
  await webhookSub.quit().catch(() => {});
  await controlSub.quit().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

log.info(`worker running (default provider=${env.WA_PROVIDER}; per-org drivers resolved lazily)`);
