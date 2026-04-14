import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, eq } from "drizzle-orm";
import { getDb, campaigns } from "@hms/db";
import { requireAuth, currentOrgId } from "../auth.js";
import { subRedis, campaignChannel } from "../redis.js";

const db = getDb();

export const sseRoutes = new Hono()
  .use(requireAuth)
  .get("/campaigns/:id/events", async (c) => {
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.orgId, orgId)))
      .limit(1);
    if (!campaign) return c.json({ error: "not_found" }, 404);

    return streamSSE(c, async (stream) => {
      const channel = campaignChannel(id);
      const sub = subRedis.duplicate();
      await sub.subscribe(channel);

      await stream.writeSSE({
        event: "snapshot",
        data: JSON.stringify({
          type: "snapshot",
          campaignId: id,
          status: campaign.status,
          totals: {
            queued: campaign.totalsQueued,
            sent: campaign.totalsSent,
            delivered: campaign.totalsDelivered,
            seen: campaign.totalsSeen,
            failed: campaign.totalsFailed,
          },
        }),
      });

      const handler = (_: string, payload: string) => {
        stream.writeSSE({ event: "progress", data: payload }).catch(() => {});
      };
      sub.on("message", handler);

      const ping = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "1" }).catch(() => {});
      }, 15000);

      stream.onAbort(async () => {
        clearInterval(ping);
        await sub.unsubscribe(channel);
        await sub.quit();
      });

      // keep the stream open until the client disconnects
      await new Promise<void>((resolve) => stream.onAbort(resolve));
    });
  });
