// Creates a new isolated tenant: organization + settings row + default
// audiences + one admin user. Invoked by `clientora tenant:add`.
//
// Env inputs (all required):
//   NEW_ORG_NAME     organization display name
//   NEW_EMAIL        admin email (must not already exist)
//   NEW_PASSWORD     admin password (bcrypt hashed with cost 12, matching seed.ts)

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "./client.js";
import { organizations, users, settings } from "./schema.js";
import { createDefaultAudiences } from "./defaults.js";

(async () => {
  const orgName = process.env.NEW_ORG_NAME;
  const email = process.env.NEW_EMAIL;
  const password = process.env.NEW_PASSWORD;
  if (!orgName || !email || !password) {
    throw new Error("NEW_ORG_NAME, NEW_EMAIL, NEW_PASSWORD are all required");
  }

  const db = getDb();

  const [clash] = await db.select().from(users).where(eq(users.email, email));
  if (clash) {
    throw new Error(`email ${email} already exists (user=${clash.id}, org=${clash.orgId})`);
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: orgName,
      defaultLanguage: "en",
      onboardingState: { defaultAudiencesCreated: true },
    })
    .returning();

  await db.insert(settings).values({
    orgId: org!.id,
    waProvider: "mock",
    brandPrimaryColor: "#14a77a",
  });

  await createDefaultAudiences(db, org!.id);

  const passwordHash = await bcrypt.hash(password, 12);
  const [u] = await db
    .insert(users)
    .values({
      orgId: org!.id,
      email,
      passwordHash,
      role: "admin",
      emailVerified: true,
    })
    .returning();

  console.log(`created isolated tenant:`);
  console.log(`  org:  ${org!.name}  (id=${org!.id})`);
  console.log(`  user: ${u!.email}   (id=${u!.id}, role=admin)`);
  process.exit(0);
})().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
