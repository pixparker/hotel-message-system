import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  jsonb,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const guestStatus = pgEnum("guest_status", ["checked_in", "checked_out"]);
export const userRole = pgEnum("user_role", ["admin", "staff"]);
export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "sending",
  "done",
  "cancelled",
]);
export const messageStatus = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const waProvider = pgEnum("wa_provider", ["mock", "cloud", "baileys"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  defaultLanguage: text("default_language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("staff"),
    testPhone: text("test_phone"),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailOrgIdx: index("users_email_org_idx").on(t.orgId, t.email),
  }),
);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    language: text("language").notNull().default("en"),
    roomNumber: text("room_number"),
    status: guestStatus("status").notNull().default("checked_in"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgStatusIdx: index("guests_org_status_idx").on(t.orgId, t.status),
    orgPhoneIdx: index("guests_org_phone_idx").on(t.orgId, t.phoneE164),
  }),
);

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateBodies = pgTable(
  "template_bodies",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    body: text("body").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.templateId, t.language] }),
  }),
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    templateId: uuid("template_id").references(() => templates.id),
    customBodies: jsonb("custom_bodies").$type<Record<string, string> | null>(),
    recipientFilter: jsonb("recipient_filter").$type<{ status?: "checked_in" | "checked_out" }>().notNull(),
    isTest: boolean("is_test").notNull().default(false),
    status: campaignStatus("status").notNull().default("draft"),
    totalsQueued: integer("totals_queued").notNull().default(0),
    totalsSent: integer("totals_sent").notNull().default(0),
    totalsDelivered: integer("totals_delivered").notNull().default(0),
    totalsSeen: integer("totals_seen").notNull().default(0),
    totalsFailed: integer("totals_failed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    orgCreatedIdx: index("campaigns_org_created_idx").on(t.orgId, t.createdAt),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id),
    phoneE164: text("phone_e164").notNull(),
    language: text("language").notNull(),
    renderedBody: text("rendered_body").notNull(),
    providerMessageId: text("provider_message_id"),
    status: messageStatus("status").notNull().default("queued"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => ({
    campaignIdx: index("messages_campaign_idx").on(t.campaignId),
    providerIdx: index("messages_provider_idx").on(t.providerMessageId),
    orgIdx: index("messages_org_idx").on(t.orgId),
  }),
);

export const settings = pgTable("settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  waProvider: waProvider("wa_provider").notNull().default("mock"),
  waConfig: jsonb("wa_config").$type<Record<string, unknown>>().notNull().default({}),
  defaultTestPhone: text("default_test_phone"),
  brandPrimaryColor: text("brand_primary_color"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    jti: text("jti").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedBy: text("replaced_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("refresh_tokens_user_idx").on(t.userId),
  }),
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  guests: many(guests),
  templates: many(templates),
  campaigns: many(campaigns),
  settings: one(settings, { fields: [organizations.id], references: [settings.orgId] }),
}));

export const templatesRelations = relations(templates, ({ many, one }) => ({
  bodies: many(templateBodies),
  org: one(organizations, { fields: [templates.orgId], references: [organizations.id] }),
}));

export const templateBodiesRelations = relations(templateBodies, ({ one }) => ({
  template: one(templates, {
    fields: [templateBodies.templateId],
    references: [templates.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ many, one }) => ({
  messages: many(messages),
  template: one(templates, {
    fields: [campaigns.templateId],
    references: [templates.id],
  }),
  createdByUser: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
  guest: one(guests, { fields: [messages.guestId], references: [guests.id] }),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type TemplateBody = typeof templateBodies.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
