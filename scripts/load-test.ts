#!/usr/bin/env tsx
/**
 * Task 18: Campaign load test.
 *
 * Drives a synthetic 5k-message campaign through the local stack using the
 * mock wa-driver. Measures:
 *   - enqueue latency (api → BullMQ)
 *   - per-message send latency (BullMQ wait + processing)
 *   - queue drain time (first job → last terminal status)
 *   - throughput (msgs/sec)
 *
 * Mock driver simulates Meta latencies, so numbers aren't Meta-accurate but
 * they expose our own bottlenecks (DB pool, worker concurrency, Redis limits).
 *
 * Usage:
 *   # Start docker compose stack, seed an org, run the api + worker.
 *   pnpm tsx scripts/load-test.ts --guests 5000 --org-id <orgId>
 *
 * Tuning knobs worth sweeping:
 *   - apps/worker concurrency (default 5)
 *   - WORKER_ORG_MSGS_PER_MINUTE (default 80)
 *   - Postgres pool size (postgres() driver defaults)
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, eq, and } from "drizzle-orm";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { guests, campaigns, messages, organizations } from "@hms/db";

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

// --- CLI flags ---
const args = process.argv.slice(2);
function flag(name: string, fallback?: string) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const TARGET_GUESTS = Number(flag("guests", "5000"));
const EXPLICIT_ORG = flag("org-id");

const client = postgres(DATABASE_URL, { max: 10 });
const db = drizzle(client);
const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("send-message", { connection: redis });

async function main() {
  // 1. Resolve the org.
  const orgId = EXPLICIT_ORG ?? (await db.select().from(organizations).limit(1))[0]?.id;
  if (!orgId) {
    console.error("No org found. Pass --org-id or seed first.");
    process.exit(1);
  }
  console.log(`Running load test for org ${orgId}`);

  // 2. Seed synthetic guests if we don't already have enough.
  await db.execute(sql`SELECT set_config('app.current_org', ${orgId}, true)`);
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(guests)
    .where(eq(guests.orgId, orgId));
  const have = Number(existing[0]?.count ?? 0);
  const needed = TARGET_GUESTS - have;
  if (needed > 0) {
    console.log(`Seeding ${needed} synthetic guests…`);
    const batchSize = 1000;
    for (let offset = 0; offset < needed; offset += batchSize) {
      const n = Math.min(batchSize, needed - offset);
      const rows = Array.from({ length: n }, (_, i) => ({
        orgId,
        name: `Load Test Guest ${have + offset + i}`,
        phoneE164: `+900000${String(have + offset + i).padStart(7, "0")}`,
        language: "en",
        status: "checked_in" as const,
      }));
      await db.insert(guests).values(rows);
    }
  }

  // 3. Create a campaign with 5k recipients.
  const recipients = await db
    .select()
    .from(guests)
    .where(and(eq(guests.orgId, orgId), eq(guests.status, "checked_in")))
    .limit(TARGET_GUESTS);

  console.log(`Creating campaign for ${recipients.length} recipients…`);
  const [campaign] = await db
    .insert(campaigns)
    .values({
      orgId,
      createdBy: (await db.execute(sql`SELECT id FROM users WHERE org_id = ${orgId} LIMIT 1`))[0]!.id as string,
      title: `Load test ${new Date().toISOString()}`,
      recipientFilter: { status: "checked_in" },
      status: "sending",
      totalsQueued: recipients.length,
      startedAt: new Date(),
      customBodies: { en: "Load test ping" },
    })
    .returning();

  if (!campaign) throw new Error("failed to create campaign");

  const enqueueStart = Date.now();
  const messageRows = await db
    .insert(messages)
    .values(
      recipients.map((g) => ({
        orgId,
        campaignId: campaign.id,
        guestId: g.id,
        phoneE164: g.phoneE164,
        language: "en",
        renderedBody: "Load test ping",
        status: "queued" as const,
        idempotencyKey: `${campaign.id}:${g.id}`,
      })),
    )
    .returning({ id: messages.id });

  await queue.addBulk(
    messageRows.map((m) => ({
      name: "send",
      data: { messageId: m.id, campaignId: campaign.id, orgId },
      opts: { attempts: 3 },
    })),
  );
  const enqueueMs = Date.now() - enqueueStart;
  console.log(`Enqueue: ${messageRows.length} jobs in ${enqueueMs}ms (${(messageRows.length / enqueueMs * 1000).toFixed(0)} jobs/s)`);

  // 4. Poll campaign totals until done.
  console.log("Waiting for drain…");
  const drainStart = Date.now();
  let last = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [row] = await db
      .select({
        sent: campaigns.totalsSent,
        delivered: campaigns.totalsDelivered,
        seen: campaigns.totalsSeen,
        failed: campaigns.totalsFailed,
        status: campaigns.status,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    if (!row) break;

    const complete = Number(row.seen) + Number(row.failed);
    if (complete !== last) {
      const elapsed = (Date.now() - drainStart) / 1000;
      console.log(
        `  t=${elapsed.toFixed(0)}s  sent=${row.sent}  delivered=${row.delivered}  seen=${row.seen}  failed=${row.failed}`,
      );
      last = complete;
    }

    if (row.status === "done" || complete >= messageRows.length) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const drainMs = Date.now() - drainStart;
  console.log(`\nDrain: ${drainMs}ms`);
  console.log(`Throughput: ${(messageRows.length / drainMs * 1000).toFixed(1)} msgs/s`);

  await client.end();
  await redis.quit();
  await queue.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
