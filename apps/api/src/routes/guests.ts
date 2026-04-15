import { Hono } from "hono";
import { and, eq, desc, inArray } from "drizzle-orm";
import { parse as parseCsv } from "csv-parse/sync";
import { guests } from "@hms/db";
import {
  guestCreateSchema,
  guestUpdateSchema,
  normalizePhone,
  isValidPhone,
  SUPPORTED_LANGUAGES,
} from "@hms/shared";
import { requireAuth, currentOrgId } from "../auth.js";
import { withTenant } from "../tenant.js";
import { rateLimit } from "../rate-limit.js";
import { auditLog, auditContext } from "../audit.js";

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
function parseGuestCsv(text: string): { rows: ParsedRow[]; error?: string } {
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

export const guestRoutes = new Hono()
  .use(requireAuth)
  .use(withTenant)
  .get("/", async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const status = c.req.query("status") as "checked_in" | "checked_out" | undefined;
    const rows = await db
      .select()
      .from(guests)
      .where(
        status
          ? and(eq(guests.orgId, orgId), eq(guests.status, status))
          : eq(guests.orgId, orgId),
      )
      .orderBy(desc(guests.checkedInAt));
    return c.json(rows);
  })
  .post("/", async (c) => {
    const db = c.var.db;
    const body = guestCreateSchema.parse(await c.req.json());
    const orgId = currentOrgId(c);
    const phoneE164 = normalizePhone(body.phone);
    const [row] = await db
      .insert(guests)
      .values({
        orgId,
        name: body.name,
        phoneE164,
        language: body.language,
        roomNumber: body.roomNumber?.trim() || null,
        status: "checked_in",
      })
      .returning();
    return c.json(row, 201);
  })
  .patch("/:id", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const body = guestUpdateSchema.parse(await c.req.json());
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.phone) patch.phoneE164 = normalizePhone(body.phone);
    if (body.language) patch.language = body.language;
    if (body.roomNumber !== undefined)
      patch.roomNumber = body.roomNumber?.trim() || null;
    const [row] = await db
      .update(guests)
      .set(patch)
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .post("/:id/checkout", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(guests)
      .set({ status: "checked_out", checkedOutAt: new Date() })
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  .post("/:id/checkin", async (c) => {
    const db = c.var.db;
    const id = c.req.param("id");
    const orgId = currentOrgId(c);
    const [row] = await db
      .update(guests)
      .set({ status: "checked_in", checkedOutAt: null, checkedInAt: new Date() })
      .where(and(eq(guests.id, id), eq(guests.orgId, orgId)))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  })
  /**
   * Dry-run preview of a CSV import. Returns parsed rows, invalid rows with
   * reasons, and duplicate detection against existing guests in this org.
   * Does NOT write any data.
   */
  .post("/import/preview", importLimiter, async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const { csv } = (await c.req.json()) as { csv?: string };
    if (!csv || typeof csv !== "string") {
      return c.json({ error: "missing_csv" }, 400);
    }
    const { rows, error } = parseGuestCsv(csv);
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
          .select({ phoneE164: guests.phoneE164 })
          .from(guests)
          .where(and(eq(guests.orgId, orgId), inArray(guests.phoneE164, phones)))
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
   * preview. Skips duplicates (within file + existing rows). Synchronous for
   * up to MAX_CSV_ROWS; larger files should use an async job (future).
   */
  .post("/import", importLimiter, async (c) => {
    const db = c.var.db;
    const orgId = currentOrgId(c);
    const { csv } = (await c.req.json()) as { csv?: string };
    if (!csv || typeof csv !== "string") {
      return c.json({ error: "missing_csv" }, 400);
    }
    const { rows, error } = parseGuestCsv(csv);
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
          .select({ phoneE164: guests.phoneE164 })
          .from(guests)
          .where(and(eq(guests.orgId, orgId), inArray(guests.phoneE164, phones)))
      : [];
    const existingSet = new Set(existingRows.map((r) => r.phoneE164));
    const toInsert = toCheck.filter((r) => r.phoneE164 && !existingSet.has(r.phoneE164));

    if (toInsert.length === 0) {
      return c.json({ inserted: 0, skipped: valid.length });
    }

    const inserted = await db
      .insert(guests)
      .values(
        toInsert.map((r) => ({
          orgId,
          name: r.name,
          phoneE164: r.phoneE164!,
          language: r.language,
          roomNumber: r.roomNumber ?? null,
          status: "checked_in" as const,
        })),
      )
      .returning();

    const ctx = auditContext(c);
    await auditLog({
      orgId,
      userId: c.get("auth").sub,
      action: "guests.import",
      metadata: {
        total: rows.length,
        inserted: inserted.length,
        skippedExisting: existingSet.size,
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
