import bcrypt from "bcryptjs";
import { getDb } from "./client.js";
import {
  organizations,
  users,
  contacts,
  contactAudiences,
  templates,
  templateBodies,
  settings,
} from "./schema.js";
import { createDefaultAudiences } from "./defaults.js";

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
  .values({
    name: ORG_NAME,
    defaultLanguage: "en",
    onboardingState: { defaultAudiencesCreated: true },
  })
  .returning();

await db.insert(settings).values({
  orgId: org!.id,
  waProvider: "mock",
  brandPrimaryColor: "#14a77a",
});

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

// System audiences (Hotel Guests / VIP / Friends) for the new org.
const defaults = await createDefaultAudiences(db, org!.id);

// ~70% of contacts get a room number; the rest are walk-ins / unassigned.
const insertedContacts = await db
  .insert(contacts)
  .values([
    { orgId: org!.id, name: "Ayşe Yılmaz", phoneE164: "+905321112233", language: "tr", source: "hotel", status: "checked_in", checkedInAt: new Date(), roomNumber: "204" },
    { orgId: org!.id, name: "John Parker", phoneE164: "+14155552671", language: "en", source: "hotel", status: "checked_in", checkedInAt: new Date(), roomNumber: "312" },
    { orgId: org!.id, name: "Farhad Karimi", phoneE164: "+989121234567", language: "fa", source: "hotel", status: "checked_in", checkedInAt: new Date(), roomNumber: "508" },
    { orgId: org!.id, name: "Marta Silva", phoneE164: "+351912345678", language: "en", source: "hotel", status: "checked_in", checkedInAt: new Date() },
    { orgId: org!.id, name: "Mehmet Demir", phoneE164: "+905331234567", language: "tr", source: "hotel", status: "checked_in", checkedInAt: new Date(), roomNumber: "221" },
    { orgId: org!.id, name: "Sara Ahmadi", phoneE164: "+989351112233", language: "fa", source: "hotel", status: "checked_in", checkedInAt: new Date(), roomNumber: "417" },
    {
      orgId: org!.id,
      name: "David Cohen",
      phoneE164: "+447700900123",
      language: "en",
      source: "hotel",
      status: "checked_out",
      checkedInAt: new Date(Date.now() - 172800000),
      checkedOutAt: new Date(Date.now() - 86400000),
    },
  ])
  .returning({ id: contacts.id });

// All seed contacts belong to Hotel Guests — this mirrors what the M1
// migration does for pre-existing databases.
await db.insert(contactAudiences).values(
  insertedContacts.map((c) => ({
    contactId: c.id,
    audienceId: defaults.hotel_guests.id,
    orgId: org!.id,
  })),
);

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
    orgId: org!.id,
    language: "en",
    body: "Welcome to Reform Hotel! Your Wi-Fi password is GUEST2026. Reception is open 24/7 — just reply to this message if you need anything.",
  },
  {
    templateId: welcome!.id,
    orgId: org!.id,
    language: "tr",
    body: "Reform Hotel'e hoş geldiniz! Wi-Fi şifreniz: GUEST2026. Her türlü ihtiyacınız için bu mesaja yanıt verebilirsiniz.",
  },
  {
    templateId: welcome!.id,
    orgId: org!.id,
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
    orgId: org!.id,
    language: "en",
    body: "Good morning! Breakfast is served in the main restaurant from 07:00 to 10:30. Have a lovely day.",
  },
  {
    templateId: breakfast!.id,
    orgId: org!.id,
    language: "tr",
    body: "Günaydın! Kahvaltı ana restoranda 07:00-10:30 arasında servis edilmektedir. İyi günler dileriz.",
  },
  {
    templateId: breakfast!.id,
    orgId: org!.id,
    language: "fa",
    body: "صبح بخیر! صبحانه در رستوران اصلی از ساعت ۷:۰۰ تا ۱۰:۳۰ سرو می‌شود. روز خوبی داشته باشید.",
  },
]);

console.log(`seeded: org=${org!.id} admin=${admin!.email} / ${ADMIN_PASSWORD}`);
await db.$client.end();
