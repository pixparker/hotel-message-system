import { Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";
import { eq, and, sql } from "drizzle-orm";
import { getDb, messages, campaigns, settings } from "@hms/db";
import { createDriver, type WaDriver } from "@hms/wa-driver";
import { env } from "./env.js";

const log = pino({ name: "worker", level: env.LOG_LEVEL });
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const pub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const db = getDb(env.DATABASE_URL);

// Single shared driver for M1 (one org, one WA account).
const driver: WaDriver = createDriver(env.WA_PROVIDER);

// Map providerMessageId → {campaignId, messageId} so status callbacks can find the row fast.
const inflight = new Map<string, { messageId: string; campaignId: string }>();

driver.onStatus(async (e) => {
  const ref = inflight.get(e.providerMessageId);
  if (!ref) return;

  const now = e.at ?? new Date();
  const patch: Record<string, unknown> = { status: e.status };
  if (e.status === "delivered") patch.deliveredAt = now;
  if (e.status === "read") patch.readAt = now;
  if (e.status === "failed") patch.error = e.error ?? "unknown";

  await db.update(messages).set(patch).where(eq(messages.id, ref.messageId));

  const counterCol =
    e.status === "delivered"
      ? "totals_delivered"
      : e.status === "read"
        ? "totals_seen"
        : "totals_failed";
  await db.execute(
    sql`update campaigns set ${sql.raw(counterCol)} = ${sql.raw(counterCol)} + 1 where id = ${ref.campaignId}`,
  );

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
    await maybeFinalizeCampaign(ref.campaignId);
  }
});

async function maybeFinalizeCampaign(campaignId: string) {
  const [row] = await db.execute(
    sql`select totals_queued, totals_sent, totals_delivered, totals_seen, totals_failed, status
        from campaigns where id = ${campaignId}`,
  );
  if (!row) return;
  const total = Number((row as any).totals_queued);
  const done = Number((row as any).totals_seen) + Number((row as any).totals_failed);
  if (done >= total && (row as any).status === "sending") {
    await db
      .update(campaigns)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
    await pub.publish(
      `campaign:${campaignId}`,
      JSON.stringify({ type: "done", campaignId }),
    );
  }
}

new Worker(
  "send-message",
  async (job) => {
    const { messageId, campaignId } = job.data as { messageId: string; campaignId: string };

    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (!campaign || campaign.status === "cancelled") return;

    try {
      const res = await driver.sendText(msg.phoneE164, msg.renderedBody);
      inflight.set(res.providerMessageId, { messageId, campaignId });
      await db
        .update(messages)
        .set({
          status: "sent",
          sentAt: new Date(),
          providerMessageId: res.providerMessageId,
        })
        .where(eq(messages.id, messageId));
      await db.execute(
        sql`update campaigns set totals_sent = totals_sent + 1 where id = ${campaignId}`,
      );
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
      await db
        .update(messages)
        .set({ status: "failed", error: message })
        .where(eq(messages.id, messageId));
      await db.execute(
        sql`update campaigns set totals_failed = totals_failed + 1 where id = ${campaignId}`,
      );
      await pub.publish(
        `campaign:${campaignId}`,
        JSON.stringify({
          type: "progress",
          campaignId,
          messageId,
          status: "failed",
        }),
      );
      await maybeFinalizeCampaign(campaignId);
      throw err;
    }
  },
  { connection, concurrency: 5 },
);

log.info(`worker running (driver=${driver.name})`);
