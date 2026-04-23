import { Hono } from "hono";
import { and, eq, desc, inArray, or, ilike } from "drizzle-orm";
import { parse as parseCsv } from "csv-parse/sync";
import {
  contacts,
  contactAudiences,
  contactTags,
} from "@hms/db";
import {
  contactCreateSchema,
  contactUpdateSchema,
  normalizePhone,
  isValidPhone,
  SUPPORTED_LANGUAGES,
  type ContactSource,
} from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant, type TenantDb } from "../tenant.js";
import { rateLimit } from "../rate-limit.js";
import { auditLog, auditContext } from "../audit.js";
import { triggerAutoMessage } from "../auto-message.js";

// Per-org import limiter — imports are expensive, keep them bounded.
const importLimiter = rateLimit({
  windowSec: 60,
  max: 5,
  prefix: "rl:import",
  keyFrom: (c) => c.get("auth")?.orgId,
});

interface ParsedRow {
  rowNumber: number;
  name: string;
  phone: string;
  language: string;
  roomNumber?: string | undefined;
  /** Null means invalid row. */
  error?: string;
  /** Normalized E.164 phone when valid. */
  phoneE164?: string;
}

const MAX_CSV_ROWS = 5000;

/**
 * Parse raw CSV text into rows and per-row validation errors.
 * Accepts headers: name, phone, language, room_number (or roomNumber).
 */
function parseContactCsv(text: string): { rows: ParsedRow[]; error?: string } {
  let records: Record<string, string>[];
  try {
    records = parseCsv(text, {
      columns: (hdr: string[]) => hdr.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")),
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "parse_error";
    return { rows: [], error: `csv_parse_error: ${message}` };
  }

  if (records.length > MAX_CSV_ROWS) {
    return { rows: [], error: `too_many_rows (max ${MAX_CSV_ROWS})` };
  }

  const rows: ParsedRow[] = records.map((rec, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const name = (rec.name ?? "").trim();
    const phone = (rec.phone ?? "").trim();
    const language = (rec.language ?? "en").trim().toLowerCase();
    const roomRaw = (rec.room_number ?? rec.roomnumber ?? "").trim();
    const roomNumber = roomRaw || undefined;

    const out: ParsedRow = { rowNumber, name, phone, language, roomNumber };

    if (!name) out.error = "missing_name";
    else if (!phone) out.error = "missing_phone";
    else if (!isValidPhone(phone)) out.error = "invalid_phone";
    else if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language))
      out.error = "unsupported_language";
    else {
      try {
        out.phoneE164 = normalizePhone(phone);
      } catch {
        out.error = "invalid_phone";
      }
    }
    return out;
  });

  return { rows };
}

/**
 * Replace the audience memberships for a contact atomically.
 * Pass an empty array to clear all memberships.
 */
async function setAudienceMemberships(
  db: TenantDb,
  contactId: string,
  orgId: string,
  audienceIds: string[],
) {
  await db
    .delete(contactAudiences)
    .where(eq(contactAudiences.contactId, contactId));
  if (audienceIds.length > 0) {
    await db
      .insert(contactAudiences)
      .values(audienceIds.map((audienceId) => ({ contactId, audienceId, orgId })))
      .onConflictDoNothing();
  }
}

/**
 * Replace the tag memberships for a contact atomically.
 */
async function setTagMemberships(
  db: TenantDb,
  contactId: string,
  orgId: string,
  tagIds: string[],
) {
  await db.delete(contactTags).where(eq(contactTags.contactId, contactId));
  if (tagIds.length > 0) {
    await db
      .insert(contactTags)
      .values(tagIds.map((tagId) => ({ contactId, tagId, orgId })))
      .onConflictDoNothing();
  }
}

export const contactRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const status = c.req.query("status") as "checked_in" | "checked_out" | undefined;
    const source = c.req.query("source") as ContactSource | undefined;
    const audienceId = c.req.query("audienceId") ?? undefined;
    const isActiveParam = c.req.query("isActive");
    const q = c.req.query("q")?.trim();

    const conditions = [eq(contacts.orgId, orgId)];
    if (status) conditions.push(eq(contacts.status, status));
    if (source) conditions.push(eq(contacts.source, source));
    if (isActiveParam === "true") conditions.push(eq(contacts.isActive, true));
    if (isActiveParam === "false") conditions.push(eq(contacts.isActive, false));
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(contacts.name, pattern),
          ilike(contacts.phoneE164, pattern),
          ilike(contacts.roomNumber, pattern),
        )!,
      );
    }

    const baseQuery = audienceId
      ? db
          .select({
            id: contacts.id,
            orgId: contacts.orgId,
            name: contacts.name,
            phoneE164: contacts.phoneE164,
            language: contacts.language,
            source: contacts.source,
            isActive: contacts.isActive,
            roomNumber: contacts.roomNumber,
            status: contacts.status,
            checkedInAt: contacts.checkedInAt,
            checkedOutAt: contacts.checkedOutAt,
            createdAt: contacts.createdAt,
            updatedAt: contacts.updatedAt,
          })
          .from(contacts)
          .innerJoin(
            contactAudiences,
            and(
              eq(contactAudiences.contactId, contacts.id),
              eq(contactAudiences.audienceId, audienceId),
            ),
          )
      : db.select().from(contacts);

    const rows = await baseQuery
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt));

    // Fetch audience + tag memberships for these contacts so the UI can
    // render chips without a second round-trip.
    const ids = rows.map((r) => r.id);
    const [audMemberships, tagMemberships] = await Promise.all([
      ids.length
        ? db
            .select({
              contactId: contactAudiences.contactId,
              audienceId: contactAudiences.audienceId,
            })
            .from(contactAudiences)
            .where(inArray(contactAudiences.contactId, ids))
        : Promise.resolve([] as Array<{ contactId: string; audienceId: string }>),
      ids.length
        ? db
            .select({
              contactId: contactTags.contactId,
              tagId: contactTags.tagId,
            })
            .from(contactTags)
            .where(inArray(contactTags.contactId, ids))
        : Promise.resolve([] as Array<{ contactId: string; tagId: string }>),
    ]);

    const audByContact = new Map<string, string[]>();
    for (const m of audMemberships) {
      const arr = audByContact.get(m.contactId) ?? [];
      arr.push(m.audienceId);
      audByContact.set(m.contactId, arr);
    }
    const tagsByContact = new Map<string, string[]>();
    for (const m of tagMemberships) {
      const arr = tagsByContact.get(m.contactId) ?? [];
      arr.push(m.tagId);
      tagsByContact.set(m.contactId, arr);
    }

    return c.json(
      rows.map((r) => ({
        ...r,
        audienceIds: audByContact.get(r.id) ?? [],
        tagIds: tagsByContact.get(r.id) ?? [],
      })),
    );
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const body = contactCreateSchema.parse(await c.req.json());
    const orgId = currentOrgId(c);
    const phoneE164 = normalizePhone(body.phone);

    const [row] = await db
      .insert(contacts)
      .values({
        orgId,
        name: body.name,
        phoneE164,
        language: body.language,
        source: body.source ?? "manual",
        isActive: body.isActive ?? true,
        roomNumber: body.roomNumber?.trim() || null,
        // Hotel-check-in fields only when this contact will be in the Hotel
        // Guests audience (inferred from roomNumber or source=hotel).
        status: body.source === "hotel" ? "checked_in" : null,
        checkedInAt: body.source === "hotel" ? new Date() : null,
      })
      .returning();
    if (!row) return c.json({ error: "create_failed" }, 500);

    if (body.audienceIds && body.audienceIds.length > 0) {
      await setAudienceMemberships(db, row.id, orgId, body.audienceIds);
    }
    if (body.tagIds && body.tagIds.length > 0) {
      await setTagMemberships(db, row.id, orgId, body.tagIds);
    }

    // Hotel-source contacts are created already-checked-in. Treat that as a
    // check-in event so the Check-In module's auto-message fires the same way
    // it would if the staffer had toggled status from a separate UI later.
    const autoMessage =
      row.status === "checked_in"
        ? await triggerAutoMessage({
            db,
            orgId,
            contactId: row.id,
            trigger: "check_in",
            createdBy: c.get("auth").sub,
          })
        : undefined;

    return c.json(
      {
        ...row,
        audienceIds: body.audienceIds ?? [],
        tagIds: body.tagIds ?? [],
        ...(autoMessage ? { autoMessage } : {}),
      },
      201,
    );
  })
  .patch("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const body = contactUpdateSchema.parse(await c.req.json());
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) patch.name = body.name;
    if (body.phone) patch.phoneE164 = normalizePhone(body.phone);
    if (body.language) patch.language = body.language;
    if (body.source) patch.source = body.source;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (body.roomNumber !== undefined)
      patch.roomNumber = body.roomNumber?.trim() || null;

    const [row] = await db
      .update(contacts)
      .set(patch)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);

    if (body.audienceIds !== undefined) {
      await setAudienceMemberships(db, id, orgId, body.audienceIds);
    }
    if (body.tagIds !== undefined) {
      await setTagMemberships(db, id, orgId, body.tagIds);
    }

    return c.json(row);
  })
  .post("/:id/checkout", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(contacts)
      .set({
        status: "checked_out",
        checkedOutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    const autoMessage = await triggerAutoMessage({
      db,
      orgId,
      contactId: id,
      trigger: "check_out",
      createdBy: c.get("auth").sub,
    });
    return c.json({ ...row, autoMessage });
  })
  .post("/:id/checkin", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(contacts)
      .set({
        status: "checked_in",
        checkedOutAt: null,
        checkedInAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    const autoMessage = await triggerAutoMessage({
      db,
      orgId,
      contactId: id,
      trigger: "check_in",
      createdBy: c.get("auth").sub,
    });
    return c.json({ ...row, autoMessage });
  })
  /**
   * Dry-run preview of a CSV import. Returns parsed rows, invalid rows with
   * reasons, and duplicate detection against existing contacts in this org.
   * Does NOT write any data.
   */
  .post("/import/preview", importLimiter, async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const { csv } = (await c.req.json()) as { csv?: string };
    if (!csv || typeof csv !== "string") {
      return c.json({ error: "missing_csv" }, 400);
    }
    const { rows, error } = parseContactCsv(csv);
    if (error) return c.json({ error }, 400);

    const valid = rows.filter((r) => !r.error && r.phoneE164);
    const invalid = rows.filter((r) => r.error);

    // Within-file dup detection (same phone twice).
    const phoneCounts = new Map<string, number>();
    for (const r of valid) {
      if (!r.phoneE164) continue;
      phoneCounts.set(r.phoneE164, (phoneCounts.get(r.phoneE164) ?? 0) + 1);
    }
    const dupsInFile = Array.from(phoneCounts.entries())
      .filter(([, n]) => n > 1)
      .map(([phone]) => phone);

    // Existing-row dup detection.
    const phones = valid.map((r) => r.phoneE164!);
    const existingRows = phones.length
      ? await db
          .select({ phoneE164: contacts.phoneE164 })
          .from(contacts)
          .where(and(eq(contacts.orgId, orgId), inArray(contacts.phoneE164, phones)))
      : [];
    const existingSet = new Set(existingRows.map((r) => r.phoneE164));

    return c.json({
      total: rows.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      invalidRows: invalid.map((r) => ({
        rowNumber: r.rowNumber,
        name: r.name,
        phone: r.phone,
        error: r.error,
      })),
      duplicatesInFile: dupsInFile,
      duplicatesExisting: valid
        .filter((r) => r.phoneE164 && existingSet.has(r.phoneE164))
        .map((r) => ({ rowNumber: r.rowNumber, phone: r.phoneE164 })),
    });
  })
  /**
   * Actual import. Re-validates server-side so the client can't sneak past
   * preview. Skips duplicates (within file + existing rows). Optionally
   * assigns imported contacts to one audience (?audienceId=...).
   */
  .post("/import", importLimiter, async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const { csv, audienceId } = (await c.req.json()) as {
      csv?: string;
      audienceId?: string;
    };
    if (!csv || typeof csv !== "string") {
      return c.json({ error: "missing_csv" }, 400);
    }
    const { rows, error } = parseContactCsv(csv);
    if (error) return c.json({ error }, 400);

    const valid = rows.filter((r) => !r.error && r.phoneE164);

    // Dedup within file (keep first occurrence).
    const seen = new Set<string>();
    const toCheck: ParsedRow[] = [];
    for (const r of valid) {
      if (!r.phoneE164 || seen.has(r.phoneE164)) continue;
      seen.add(r.phoneE164);
      toCheck.push(r);
    }

    // Skip rows that already exist in this org.
    const phones = toCheck.map((r) => r.phoneE164!);
    const existingRows = phones.length
      ? await db
          .select({ phoneE164: contacts.phoneE164 })
          .from(contacts)
          .where(and(eq(contacts.orgId, orgId), inArray(contacts.phoneE164, phones)))
      : [];
    const existingSet = new Set(existingRows.map((r) => r.phoneE164));
    const toInsert = toCheck.filter((r) => r.phoneE164 && !existingSet.has(r.phoneE164));

    if (toInsert.length === 0) {
      return c.json({ inserted: 0, skipped: valid.length });
    }

    const inserted = await db
      .insert(contacts)
      .values(
        toInsert.map((r) => ({
          orgId,
          name: r.name,
          phoneE164: r.phoneE164!,
          language: r.language,
          source: "csv" as const,
          roomNumber: r.roomNumber ?? null,
        })),
      )
      .returning({ id: contacts.id });

    // Optionally assign all imported contacts to a single audience.
    if (audienceId && inserted.length > 0) {
      await db
        .insert(contactAudiences)
        .values(
          inserted.map((row) => ({
            contactId: row.id,
            audienceId,
            orgId,
          })),
        )
        .onConflictDoNothing();
    }

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "contacts.import",
      metadata: {
        total: rows.length,
        inserted: inserted.length,
        skippedExisting: existingSet.size,
        audienceId: audienceId ?? null,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return c.json({
      inserted: inserted.length,
      skippedExisting: existingSet.size,
      skippedInvalid: rows.length - valid.length,
    });
  });
