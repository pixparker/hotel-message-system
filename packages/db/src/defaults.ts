import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./client.js";
import { audiences } from "./schema.js";

/**
 * The 3 system audiences seeded for every org. They cannot be renamed or
 * deleted through the API. `kind` drives the icon/colour pattern in the UI.
 */
export const DEFAULT_AUDIENCES = [
  {
    name: "Hotel Guests",
    kind: "hotel_guests" as const,
    description: "Guests currently or recently staying at the hotel.",
  },
  {
    name: "VIP",
    kind: "vip" as const,
    description: "High-priority contacts for special campaigns.",
  },
  {
    name: "Friends",
    kind: "friends" as const,
    description: "Personal network and friends of the business.",
  },
];

export type DefaultAudienceKind = (typeof DEFAULT_AUDIENCES)[number]["kind"];
export type DefaultAudiencesByKind = Record<
  DefaultAudienceKind,
  { id: string; name: string }
>;

/**
 * Insert the 3 system audiences for an org if they don't already exist and
 * return them keyed by kind. Idempotent — safe to call on every signup.
 */
export async function createDefaultAudiences(
  db: Db,
  orgId: string,
): Promise<DefaultAudiencesByKind> {
  await db
    .insert(audiences)
    .values(
      DEFAULT_AUDIENCES.map((a) => ({
        orgId,
        name: a.name,
        kind: a.kind,
        description: a.description,
        isSystem: true,
      })),
    )
    .onConflictDoNothing({ target: [audiences.orgId, audiences.name] });

  const rows = await db
    .select({ id: audiences.id, name: audiences.name, kind: audiences.kind })
    .from(audiences)
    .where(
      and(
        eq(audiences.orgId, orgId),
        inArray(
          audiences.name,
          DEFAULT_AUDIENCES.map((d) => d.name),
        ),
      ),
    );

  const byKind = {} as DefaultAudiencesByKind;
  for (const row of rows) {
    byKind[row.kind as DefaultAudienceKind] = { id: row.id, name: row.name };
  }
  return byKind;
}
