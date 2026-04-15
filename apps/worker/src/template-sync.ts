import { eq, and } from "drizzle-orm";
import type { Db } from "@hms/db";
import { templates, settings } from "@hms/db";
import pino from "pino";

const log = pino({ name: "worker.template-sync" });

/**
 * Poll Meta for template approval status and update local records.
 *
 * Runs every SYNC_INTERVAL_MS for each tenant on the cloud provider that has
 * pending templates. Skips tenants without waConfig credentials.
 *
 * This is intentionally simple: we call Meta's /message_templates endpoint
 * per tenant, match by `external_name`, and set approval_status. Rate
 * limits from Meta are handled by catching errors and logging; the next
 * tick will retry naturally.
 */
export async function syncTemplatesOnce(db: Db): Promise<void> {
  // Find all tenants on the cloud provider with at least one pending template.
  const allSettings = await db.select().from(settings);
  const cloudTenants = allSettings.filter((s) => s.waProvider === "cloud");

  for (const s of cloudTenants) {
    const cfg = s.waConfig as {
      accessToken?: string;
      wabaId?: string;
    };
    if (!cfg.accessToken || !cfg.wabaId) continue;

    const pending = await db
      .select()
      .from(templates)
      .where(and(eq(templates.orgId, s.orgId), eq(templates.approvalStatus, "pending")));

    if (pending.length === 0) continue;

    try {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${cfg.wabaId}/message_templates?limit=200`,
        { headers: { authorization: `Bearer ${cfg.accessToken}` } },
      );
      if (!res.ok) {
        log.warn({ orgId: s.orgId, status: res.status }, "meta sync non-2xx");
        continue;
      }
      const body = (await res.json()) as {
        data?: Array<{ name: string; status: string }>;
      };
      const remoteByName = new Map((body.data ?? []).map((t) => [t.name, t.status]));

      for (const tpl of pending) {
        if (!tpl.externalName) continue;
        const remoteStatus = remoteByName.get(tpl.externalName);
        if (!remoteStatus) continue;

        let mapped: "approved" | "rejected" | "pending" = "pending";
        if (remoteStatus === "APPROVED") mapped = "approved";
        else if (remoteStatus === "REJECTED") mapped = "rejected";

        if (mapped !== "pending") {
          await db
            .update(templates)
            .set({ approvalStatus: mapped, lastSyncedAt: new Date() })
            .where(eq(templates.id, tpl.id));
          log.info({ orgId: s.orgId, tpl: tpl.id, status: mapped }, "template status synced");
        }
      }
    } catch (err) {
      log.warn({ err, orgId: s.orgId }, "template sync failed; retrying next tick");
    }
  }
}

/** Schedule the sync loop. Returns a cancel function. */
export function startTemplateSyncLoop(db: Db, intervalMs = 5 * 60 * 1000): () => void {
  const timer = setInterval(() => {
    syncTemplatesOnce(db).catch((err) =>
      log.error({ err }, "template sync tick failed"),
    );
  }, intervalMs);
  // Kick off the first run soon (5s) so new envs sync quickly.
  const kickoff = setTimeout(() => {
    syncTemplatesOnce(db).catch((err) =>
      log.error({ err }, "template sync kickoff failed"),
    );
  }, 5_000);
  return () => {
    clearInterval(timer);
    clearTimeout(kickoff);
  };
}
