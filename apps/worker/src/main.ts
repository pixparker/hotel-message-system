import { Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
import { eq, sql } from "drizzle-orm";
import { getDb, messages, campaigns } from "@hms/db";
import { createDriver, type WaDriver } from "@hms/wa-driver";
import { env } from "./env.js";

const log = pino({ name: "worker", level: env.LOG_LEVEL });
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const pub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const db = getDb(env.DATABASE_URL);

// Single shared driver for M1 (one org, one WA account).
const driver: WaDriver = createDriver(env.WA_PROVIDER);

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

driver.onStatus(async (e) => {
  let ref = inflight.get(e.providerMessageId);
  if (!ref) return;
  const { orgId } = ref;

  await asTenant(orgId, async (tx) => {
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
  });

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
});

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

    const result = await asTenant(orgId, async (tx) => {
      const [msg] = await tx.select().from(messages).where(eq(messages.id, messageId));
      if (!msg) return { kind: "skip" as const };

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, messageId }, "send failed");
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
      await maybeFinalizeCampaign(orgId, campaignId);
      throw err;
    }
  },
  { connection, concurrency: 5 },
);

log.info(`worker running (driver=${driver.name})`);
