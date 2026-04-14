import bcrypt from "bcryptjs";
import { getDb } from "./client.js";
import {
  organizations,
  users,
  guests,
  templates,
  templateBodies,
  settings,
} from "./schema.js";
import { eq } from "drizzle-orm";

const ORG_NAME = process.env.BOOTSTRAP_ORG_NAME ?? "Reform Hotel";
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@hotel.local";
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "changeme";

const db = getDb();

const existingOrg = await db.select().from(organizations).limit(1);
if (existingOrg.length > 0) {
  console.log("org already exists, skipping seed");
  process.exit(0);
}

const [org] = await db
  .insert(organizations)
  .values({ name: ORG_NAME, defaultLanguage: "en" })
  .returning();

await db.insert(settings).values({ orgId: org!.id, waProvider: "mock" });

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const [admin] = await db
  .insert(users)
  .values({
    orgId: org!.id,
    email: ADMIN_EMAIL,
    passwordHash,
    role: "admin",
    testPhone: "+905551112233",
  })
  .returning();

await db.insert(guests).values([
  { orgId: org!.id, name: "Ayşe Yılmaz", phoneE164: "+905321112233", language: "tr" },
  { orgId: org!.id, name: "John Parker", phoneE164: "+14155552671", language: "en" },
  { orgId: org!.id, name: "Farhad Karimi", phoneE164: "+989121234567", language: "fa" },
  { orgId: org!.id, name: "Marta Silva", phoneE164: "+351912345678", language: "en" },
  { orgId: org!.id, name: "Mehmet Demir", phoneE164: "+905331234567", language: "tr" },
  { orgId: org!.id, name: "Sara Ahmadi", phoneE164: "+989351112233", language: "fa" },
  {
    orgId: org!.id,
    name: "David Cohen",
    phoneE164: "+447700900123",
    language: "en",
    status: "checked_out",
    checkedOutAt: new Date(Date.now() - 86400000),
  },
]);

const [welcome] = await db
  .insert(templates)
  .values({
    orgId: org!.id,
    name: "Welcome to the hotel",
    description: "Sent on check-in.",
  })
  .returning();

await db.insert(templateBodies).values([
  {
    templateId: welcome!.id,
    language: "en",
    body: "Welcome to Reform Hotel! Your Wi-Fi password is GUEST2026. Reception is open 24/7 — just reply to this message if you need anything.",
  },
  {
    templateId: welcome!.id,
    language: "tr",
    body: "Reform Hotel'e hoş geldiniz! Wi-Fi şifreniz: GUEST2026. Her türlü ihtiyacınız için bu mesaja yanıt verebilirsiniz.",
  },
  {
    templateId: welcome!.id,
    language: "fa",
    body: "به هتل Reform خوش آمدید! رمز وای‌فای: GUEST2026. برای هر درخواستی کافیست همین پیام را پاسخ دهید.",
  },
]);

const [breakfast] = await db
  .insert(templates)
  .values({
    orgId: org!.id,
    name: "Breakfast reminder",
    description: "Morning reminder for the restaurant hours.",
  })
  .returning();

await db.insert(templateBodies).values([
  {
    templateId: breakfast!.id,
    language: "en",
    body: "Good morning! Breakfast is served in the main restaurant from 07:00 to 10:30. Have a lovely day.",
  },
  {
    templateId: breakfast!.id,
    language: "tr",
    body: "Günaydın! Kahvaltı ana restoranda 07:00-10:30 arasında servis edilmektedir. İyi günler dileriz.",
  },
  {
    templateId: breakfast!.id,
    language: "fa",
    body: "صبح بخیر! صبحانه در رستوران اصلی از ساعت ۷:۰۰ تا ۱۰:۳۰ سرو می‌شود. روز خوبی داشته باشید.",
  },
]);

console.log(`seeded: org=${org!.id} admin=${admin!.email} / ${ADMIN_PASSWORD}`);
await db.$client.end();
