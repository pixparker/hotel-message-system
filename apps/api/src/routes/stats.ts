import { Hono } from "hono";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  contacts,
  audiences,
  contactAudiences,
  campaigns,
  messages,
} from "@hms/db";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";

const DAY = 86400_000;

export const statsRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/dashboard", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const since7d = new Date(Date.now() - 7 * DAY);

    // Active contacts grouped by language — drives the "Active contacts"
    // tile + language-mix card on the dashboard.
    const activeByLang = await db
      .select({
        count: sql<number>`count(*)::int`,
        language: contacts.language,
      })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.isActive, true)))
      .groupBy(contacts.language);

    const totalActive = activeByLang.reduce((a, r) => a + Number(r.count), 0);

    // Checked-in subset: only contacts that belong to the Hotel Guests
    // audience AND are still checked in. The "Currently in-house" card
    // becomes meaningful only when this is non-zero.
    const checkedInByLang = await db
      .select({
        count: sql<number>`count(distinct ${contacts.id})::int`,
        language: contacts.language,
      })
      .from(contacts)
      .innerJoin(
        contactAudiences,
        eq(contactAudiences.contactId, contacts.id),
      )
      .innerJoin(audiences, eq(audiences.id, contactAudiences.audienceId))
      .where(
        and(
          eq(contacts.orgId, orgId),
          eq(contacts.isActive, true),
          eq(contacts.status, "checked_in"),
          eq(audiences.kind, "hotel_guests"),
        ),
      )
      .groupBy(contacts.language);

    const totalCheckedIn = checkedInByLang.reduce(
      (a, r) => a + Number(r.count),
      0,
    );

    // Audience breakdown — powers the "Top audiences" card.
    const byAudience = await db
      .select({
        id: audiences.id,
        name: audiences.name,
        kind: audiences.kind,
        isSystem: audiences.isSystem,
        memberCount: sql<number>`count(${contactAudiences.contactId})::int`,
      })
      .from(audiences)
      .leftJoin(
        contactAudiences,
        eq(contactAudiences.audienceId, audiences.id),
      )
      .where(eq(audiences.orgId, orgId))
      .groupBy(audiences.id)
      .orderBy(sql`count(${contactAudiences.contactId}) desc`);

    const [totals] = await db
      .select({
        campaigns: sql<number>`count(*)::int`,
      })
      .from(campaigns)
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)));

    const [last7dAgg] = await db
      .select({
        campaigns: sql<number>`count(*)::int`,
        sent: sql<number>`coalesce(sum(${campaigns.totalsSent}), 0)::int`,
        delivered: sql<number>`coalesce(sum(${campaigns.totalsDelivered}), 0)::int`,
        seen: sql<number>`coalesce(sum(${campaigns.totalsSeen}), 0)::int`,
        failed: sql<number>`coalesce(sum(${campaigns.totalsFailed}), 0)::int`,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTest, false),
          gte(campaigns.createdAt, since7d),
        ),
      );

    const [readTimeAgg] = await db
      .select({
        avgReadMs: sql<number>`coalesce(avg(extract(epoch from (${messages.readAt} - ${messages.sentAt})) * 1000), 0)::bigint`,
      })
      .from(messages)
      .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTest, false),
          gte(messages.sentAt, since7d),
        ),
      );

    const recentCampaigns = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        origin: campaigns.origin,
        createdAt: campaigns.createdAt,
        status: campaigns.status,
        queued: campaigns.totalsQueued,
        sent: campaigns.totalsSent,
        delivered: campaigns.totalsDelivered,
        seen: campaigns.totalsSeen,
      })
      .from(campaigns)
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)))
      .orderBy(sql`${campaigns.createdAt} desc`)
      .limit(5);

    const sent7d = Number(last7dAgg?.sent ?? 0);
    const seen7d = Number(last7dAgg?.seen ?? 0);
    const readRate = sent7d > 0 ? Math.round((seen7d / sent7d) * 1000) / 10 : 0;

    const activeContactsPayload = {
      total: totalActive,
      byLanguage: activeByLang.map((r) => ({
        language: r.language,
        count: Number(r.count),
      })),
    };

    const checkedInPayload = {
      total: totalCheckedIn,
      byLanguage: checkedInByLang.map((r) => ({
        language: r.language,
        count: Number(r.count),
      })),
    };

    return c.json({
      activeContacts: activeContactsPayload,
      checkedInGuests: checkedInPayload,
      byAudience: byAudience.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        isSystem: r.isSystem,
        memberCount: Number(r.memberCount),
      })),
      // Legacy key — kept until M6 swaps the frontend over to activeContacts.
      activeGuests: checkedInPayload,
      campaigns: {
        total: Number(totals?.campaigns ?? 0),
        last7dCount: Number(last7dAgg?.campaigns ?? 0),
        last7dSent: sent7d,
        last7dDelivered: Number(last7dAgg?.delivered ?? 0),
        last7dSeen: seen7d,
        last7dFailed: Number(last7dAgg?.failed ?? 0),
        readRatePercent: readRate,
        avgReadMs: Number(readTimeAgg?.avgReadMs ?? 0),
      },
      recentCampaigns,
    });
  })
  .get("/reports", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const since30d = new Date(Date.now() - 30 * DAY);
    // Client-supplied IANA timezone so daily buckets align with the user's
    // local calendar (otherwise midnight-local sends fall into the previous
    // UTC day). Validate strictly to keep this out of the raw SQL we build
    // below — Postgres will happily reject it as invalid at runtime, but
    // defense in depth.
    const rawTz = c.req.query("tz") ?? "UTC";
    const tz = /^[A-Za-z_][A-Za-z0-9_+\-/]*$/.test(rawTz) ? rawTz : "UTC";

    const [allTime] = await db
      .select({
        campaigns: sql<number>`count(*)::int`,
        queued: sql<number>`coalesce(sum(${campaigns.totalsQueued}), 0)::int`,
        sent: sql<number>`coalesce(sum(${campaigns.totalsSent}), 0)::int`,
        delivered: sql<number>`coalesce(sum(${campaigns.totalsDelivered}), 0)::int`,
        seen: sql<number>`coalesce(sum(${campaigns.totalsSeen}), 0)::int`,
        failed: sql<number>`coalesce(sum(${campaigns.totalsFailed}), 0)::int`,
      })
      .from(campaigns)
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)));

    const [uniqueRecipients] = await db
      .select({
        count: sql<number>`count(distinct ${messages.contactId})::int`,
      })
      .from(messages)
      .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)));

    const [readTiming] = await db
      .select({
        avgMs: sql<number>`coalesce(avg(extract(epoch from (${messages.readAt} - ${messages.sentAt})) * 1000), 0)::bigint`,
        medianMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by extract(epoch from (${messages.readAt} - ${messages.sentAt})) * 1000), 0)::bigint`,
      })
      .from(messages)
      .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)));

    // Per-day activity: count messages that actually reached the recipient
    // (sent/delivered/read — drops queued and failed). Also report the
    // distinct campaign count per day so the UI tooltip can show
    // "N messages · M campaigns". Grouped in the client's timezone so
    // a message sent at local 12:05 AM counts toward that local day, not
    // the previous UTC day. The tz is baked as a SQL literal (safe because
    // it's regex-validated above) — parameterizing it breaks when the same
    // fragment is reused across select / groupBy / orderBy.
    const bucket = sql`date_trunc('day', ${messages.sentAt} AT TIME ZONE ${sql.raw(`'${tz}'`)})`;
    const dailySent = await db
      .select({
        day: sql<string>`${bucket}::date::text`,
        count: sql<number>`count(*)::int`,
        campaigns: sql<number>`count(distinct ${messages.campaignId})::int`,
      })
      .from(messages)
      .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTest, false),
          gte(messages.sentAt, since30d),
          sql`${messages.status} in ('sent', 'delivered', 'read')`,
        ),
      )
      .groupBy(bucket)
      .orderBy(bucket);

    const readBuckets = await db
      .select({
        bucket: sql<string>`case
          when extract(epoch from (${messages.readAt} - ${messages.sentAt})) < 300 then 'lt5m'
          when extract(epoch from (${messages.readAt} - ${messages.sentAt})) < 1800 then 'lt30m'
          when extract(epoch from (${messages.readAt} - ${messages.sentAt})) < 3600 then 'lt1h'
          when extract(epoch from (${messages.readAt} - ${messages.sentAt})) < 10800 then 'lt3h'
          else 'gt3h'
        end`,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTest, false),
          sql`${messages.readAt} is not null`,
          sql`${messages.sentAt} is not null`,
        ),
      )
      .groupBy(sql`1`);

    const top = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        createdAt: campaigns.createdAt,
        queued: campaigns.totalsQueued,
        seen: campaigns.totalsSeen,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.orgId, orgId),
          eq(campaigns.isTest, false),
          sql`${campaigns.totalsQueued} >= 3`,
        ),
      )
      .orderBy(
        sql`(${campaigns.totalsSeen}::float / nullif(${campaigns.totalsQueued}, 0)) desc nulls last`,
      )
      .limit(1);

    const campaignsList = await db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        origin: campaigns.origin,
        createdAt: campaigns.createdAt,
        status: campaigns.status,
        queued: campaigns.totalsQueued,
        sent: campaigns.totalsSent,
        delivered: campaigns.totalsDelivered,
        seen: campaigns.totalsSeen,
        failed: campaigns.totalsFailed,
      })
      .from(campaigns)
      .where(and(eq(campaigns.orgId, orgId), eq(campaigns.isTest, false)))
      .orderBy(sql`${campaigns.createdAt} desc`)
      .limit(100);

    const sent = Number(allTime?.sent ?? 0);
    const delivered = Number(allTime?.delivered ?? 0);
    const seen = Number(allTime?.seen ?? 0);
    const uniqueCount = Number(uniqueRecipients?.count ?? 0);

    return c.json({
      totals: {
        campaigns: Number(allTime?.campaigns ?? 0),
        queued: Number(allTime?.queued ?? 0),
        sent,
        delivered,
        seen,
        failed: Number(allTime?.failed ?? 0),
        uniqueRecipients: uniqueCount,
        // Legacy alias kept until M6 swaps the Reports UI over.
        uniqueGuests: uniqueCount,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
        readRate: sent > 0 ? Math.round((seen / sent) * 1000) / 10 : 0,
      },
      readTiming: {
        avgMs: Number(readTiming?.avgMs ?? 0),
        medianMs: Number(readTiming?.medianMs ?? 0),
      },
      dailySent: dailySent.map((d) => ({
        day: d.day,
        count: Number(d.count),
        campaigns: Number(d.campaigns),
      })),
      readBuckets: Object.fromEntries(
        readBuckets.map((b) => [b.bucket, Number(b.count)]),
      ) as Record<string, number>,
      topCampaign: top[0] ?? null,
      campaigns: campaignsList,
    });
  });
