import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  jsonb,
  boolean,
  customType,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Buffer-typed bytea column. Drizzle's default `customType` returning Buffer
// is the idiomatic way to read/write bytea without string-encoding detours.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});
import { relations } from "drizzle-orm";

// Hotel-specific status enum. The pg type name stays "guest_status" to avoid
// a risky ALTER TYPE RENAME during partial deploys; only the TS symbol is the
// generic `contactStatus`.
export const contactStatus = pgEnum("guest_status", [
  "checked_in",
  "checked_out",
]);
export const userRole = pgEnum("user_role", ["admin", "staff"]);
export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "sending",
  "done",
  "cancelled",
]);
export const campaignOrigin = pgEnum("campaign_origin", [
  "manual",
  "auto_check_in",
  "auto_check_out",
]);
export const messageStatus = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const waProvider = pgEnum("wa_provider", ["mock", "cloud", "baileys"]);
export const templateApprovalStatus = pgEnum("template_approval_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
]);
export const contactSource = pgEnum("contact_source", [
  "manual",
  "hotel",
  "csv",
  "future",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  defaultLanguage: text("default_language").notNull().default("en"),
  onboardingState: jsonb("onboarding_state").$type<Record<string, unknown>>().notNull().default({}),
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

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    language: text("language").notNull().default("en"),
    source: contactSource("source").notNull().default("manual"),
    isActive: boolean("is_active").notNull().default(true),
    // Hotel-specific columns — kept for backwards compatibility; nullable
    // because generic contacts (friends, VIPs) don't check in/out.
    roomNumber: text("room_number"),
    status: contactStatus("status"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgStatusIdx: index("contacts_org_status_idx").on(t.orgId, t.status),
    orgPhoneIdx: index("contacts_org_phone_idx").on(t.orgId, t.phoneE164),
    orgSourceIdx: index("contacts_org_source_idx").on(t.orgId, t.source),
    orgActiveIdx: index("contacts_org_active_idx").on(t.orgId, t.isActive),
  }),
);

export const audiences = pgTable(
  "audiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("custom"),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("audiences_org_idx").on(t.orgId),
    orgNameUnq: uniqueIndex("audiences_org_name_unq").on(t.orgId, t.name),
  }),
);

export const contactAudiences = pgTable(
  "contact_audiences",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    audienceId: uuid("audience_id")
      .notNull()
      .references(() => audiences.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.contactId, t.audienceId] }),
    audienceIdx: index("contact_audiences_audience_idx").on(t.audienceId),
    orgIdx: index("contact_audiences_org_idx").on(t.orgId),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("tags_org_idx").on(t.orgId),
    orgLabelUnq: uniqueIndex("tags_org_label_unq").on(t.orgId, t.label),
  }),
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.contactId, t.tagId] }),
    tagIdx: index("contact_tags_tag_idx").on(t.tagId),
  }),
);

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  externalName: text("external_name"),
  approvalStatus: templateApprovalStatus("approval_status").notNull().default("draft"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
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
    // Kept nullable for future dynamic-segment support. Audience-based
    // targeting is now carried by the campaign_audiences junction.
    recipientFilter: jsonb("recipient_filter").$type<{
      status?: "checked_in" | "checked_out";
    } | null>(),
    isTest: boolean("is_test").notNull().default(false),
    origin: campaignOrigin("origin").notNull().default("manual"),
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
    orgOriginIdx: index("campaigns_org_origin_idx").on(t.orgId, t.origin),
  }),
);

export const campaignAudiences = pgTable(
  "campaign_audiences",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    audienceId: uuid("audience_id").references(() => audiences.id, {
      onDelete: "set null",
    }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.campaignId, t.audienceId] }),
    audienceIdx: index("campaign_audiences_audience_idx").on(t.audienceId),
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
    contactId: uuid("contact_id").references(() => contacts.id),
    phoneE164: text("phone_e164").notNull(),
    language: text("language").notNull(),
    renderedBody: text("rendered_body").notNull(),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
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

/**
 * Per-workspace state for opt-in modules. Each module owns one key in this
 * map and is free to evolve its own shape. Today only `checkIn` is shipped
 * (auto messages around check-in/check-out events).
 */
export type ModulesState = {
  checkIn?: {
    enabled?: boolean;
    checkInTemplateId?: string | null;
    checkOutTemplateId?: string | null;
  };
};

export const settings = pgTable("settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  waProvider: waProvider("wa_provider").notNull().default("mock"),
  waConfig: jsonb("wa_config").$type<Record<string, unknown>>().notNull().default({}),
  defaultTestPhone: text("default_test_phone"),
  brandPrimaryColor: text("brand_primary_color"),
  modules: jsonb("modules").$type<ModulesState>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  rejected: boolean("rejected").notNull().default(false),
  rejectionReason: text("rejection_reason"),
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

// Baileys (WhatsApp Web) per-org session — see migration 0012.
export const waBaileysSessions = pgTable("wa_baileys_sessions", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  creds: bytea("creds"),
  // pending | connected | logged_out | failed
  status: text("status").notNull().default("pending"),
  phoneE164: text("phone_e164"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  // careful | balanced | custom
  throttleMode: text("throttle_mode").notNull().default("careful"),
  customRatePerMin: integer("custom_rate_per_min"),
  dailyCap: integer("daily_cap").notNull().default(500),
  // warn | block | allow
  coldPolicy: text("cold_policy").notNull().default("warn"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  bannedSuspectedAt: timestamp("banned_suspected_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waBaileysKeys = pgTable(
  "wa_baileys_keys",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    keyType: text("key_type").notNull(),
    keyId: text("key_id").notNull(),
    value: bytea("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.keyType, t.keyId] }),
    orgTypeIdx: index("wa_baileys_keys_org_type_idx").on(t.orgId, t.keyType),
  }),
);

// Inbound-touch log — see migration 0013. Powers the pre-flight "has this
// recipient messaged us before?" check. Never stores message bodies.
export const waInboundTouches = pgTable(
  "wa_inbound_touches",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fromE164: text("from_e164").notNull(),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
    count: integer("count").notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.fromE164] }),
    orgLastIdx: index("wa_inbound_touches_org_last_idx").on(t.orgId, t.lastAt),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreatedIdx: index("audit_events_org_created_idx").on(t.orgId, t.createdAt),
    actionIdx: index("audit_events_action_idx").on(t.action),
  }),
);

// Relations -----------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  contacts: many(contacts),
  audiences: many(audiences),
  tags: many(tags),
  templates: many(templates),
  campaigns: many(campaigns),
  settings: one(settings, { fields: [organizations.id], references: [settings.orgId] }),
}));

export const contactsRelations = relations(contacts, ({ many, one }) => ({
  org: one(organizations, {
    fields: [contacts.orgId],
    references: [organizations.id],
  }),
  audiences: many(contactAudiences),
  tags: many(contactTags),
}));

export const audiencesRelations = relations(audiences, ({ many, one }) => ({
  org: one(organizations, {
    fields: [audiences.orgId],
    references: [organizations.id],
  }),
  members: many(contactAudiences),
  campaigns: many(campaignAudiences),
}));

export const contactAudiencesRelations = relations(contactAudiences, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactAudiences.contactId],
    references: [contacts.id],
  }),
  audience: one(audiences, {
    fields: [contactAudiences.audienceId],
    references: [audiences.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many, one }) => ({
  org: one(organizations, { fields: [tags.orgId], references: [organizations.id] }),
  contacts: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
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
  audiences: many(campaignAudiences),
}));

export const campaignAudiencesRelations = relations(campaignAudiences, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAudiences.campaignId],
    references: [campaigns.id],
  }),
  audience: one(audiences, {
    fields: [campaignAudiences.audienceId],
    references: [audiences.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [messages.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, { fields: [messages.contactId], references: [contacts.id] }),
}));

// Backwards-compat aliases. M3 will drop these once all call sites move to
// the new names.
export const guests = contacts;
export const guestStatus = contactStatus;

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Guest = Contact;
export type Audience = typeof audiences.$inferSelect;
export type ContactAudience = typeof contactAudiences.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ContactTag = typeof contactTags.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type TemplateBody = typeof templateBodies.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignAudience = typeof campaignAudiences.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type WaBaileysSession = typeof waBaileysSessions.$inferSelect;
export type WaBaileysKey = typeof waBaileysKeys.$inferSelect;
export type WaInboundTouch = typeof waInboundTouches.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
