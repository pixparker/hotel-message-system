import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "./languages.js";
import { isValidPhone } from "./phone.js";

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

export const phoneSchema = z
  .string()
  .min(1, "Phone is required")
  .refine((v) => isValidPhone(v), {
    message: "Invalid phone number (use international format, e.g. +90 555 123 45 67)",
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Contacts --------------------------------------------------------------

export const contactSourceSchema = z.enum(["manual", "hotel", "csv", "future"]);

export const contactCreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: phoneSchema,
  language: languageSchema,
  source: contactSourceSchema.optional(),
  isActive: z.boolean().optional(),
  roomNumber: z.string().max(20).optional(),
  audienceIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

/** @deprecated use contactCreateSchema */
export const guestCreateSchema = contactCreateSchema;
/** @deprecated use contactUpdateSchema */
export const guestUpdateSchema = contactUpdateSchema;

// --- Audiences -------------------------------------------------------------

export const audienceKindSchema = z.enum([
  "hotel_guests",
  "vip",
  "friends",
  "custom",
]);

export const audienceCreateSchema = z.object({
  name: z.string().min(1).max(80),
  kind: audienceKindSchema.optional().default("custom"),
  description: z.string().max(300).optional(),
});

export const audienceUpdateSchema = audienceCreateSchema.partial();

export const audienceMembershipSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(1000),
});

// --- Tags ------------------------------------------------------------------

export const hexColorSchema = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color, e.g. #14a77a")
  .transform((v) => (v.startsWith("#") ? v.toLowerCase() : `#${v.toLowerCase()}`));

export const tagCreateSchema = z.object({
  label: z.string().min(1).max(40),
  color: hexColorSchema.optional(),
});

export const tagUpdateSchema = tagCreateSchema.partial();

// --- Templates -------------------------------------------------------------

export const templateBodySchema = z.object({
  language: languageSchema,
  body: z.string().min(1).max(4096),
});

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  bodies: z.array(templateBodySchema).min(1),
});

// --- Campaigns -------------------------------------------------------------

// Legacy hotel-status recipient filter. Kept as an optional input so existing
// callers keep working until M5 switches to audience-based targeting.
export const recipientFilterSchema = z.object({
  status: z.enum(["checked_in", "checked_out"]).default("checked_in"),
});

export const campaignCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    templateId: z.string().uuid().optional(),
    customBodies: z.record(languageSchema, z.string().min(1).max(4096)).optional(),
    recipientFilter: recipientFilterSchema.default({ status: "checked_in" }),
    audienceIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => v.templateId || (v.customBodies && Object.keys(v.customBodies).length > 0), {
    message: "Provide either templateId or customBodies",
    path: ["templateId"],
  });

export const testMessageSchema = z.object({
  phone: phoneSchema,
  templateId: z.string().uuid().optional(),
  customBodies: z.record(languageSchema, z.string().min(1).max(4096)).optional(),
  language: languageSchema,
});

// --- WhatsApp + settings ---------------------------------------------------

// WhatsApp per-tenant configuration. Extra fields are preserved (passthrough)
// so we can add provider-specific config without a coordinated migration.
export const waConfigSchema = z
  .object({
    phoneNumberId: z.string().min(1).optional(),
    wabaId: z.string().min(1).optional(),
    accessToken: z.string().min(1).optional(),
    appSecret: z.string().min(1).optional(),
  })
  .passthrough();

export type WaConfig = z.infer<typeof waConfigSchema>;

export const settingsUpdateSchema = z.object({
  waProvider: z.enum(["mock", "cloud", "baileys"]).optional(),
  waConfig: waConfigSchema.optional(),
  defaultTestPhone: phoneSchema.optional(),
  brandPrimaryColor: hexColorSchema.nullable().optional(),
});

export const userUpdateSchema = z.object({
  testPhone: phoneSchema.optional(),
});

// --- Streamed events (API → UI via SSE) ------------------------------------

export const sseEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    campaignId: z.string().uuid(),
    totals: z.object({
      queued: z.number(),
      sent: z.number(),
      delivered: z.number(),
      seen: z.number(),
      failed: z.number(),
    }),
    status: z.enum(["draft", "sending", "done", "cancelled"]),
  }),
  z.object({
    type: z.literal("progress"),
    campaignId: z.string().uuid(),
    messageId: z.string().uuid(),
    status: z.enum(["sent", "delivered", "read", "failed"]),
  }),
  z.object({
    type: z.literal("done"),
    campaignId: z.string().uuid(),
  }),
]);

export type SseEvent = z.infer<typeof sseEventSchema>;

// --- Auth flows (Task 3) ---------------------------------------------------

export const registerSchema = z.object({
  orgName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  populateSampleData: z.boolean().optional().default(false),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

// --- Types ----------------------------------------------------------------

export type LoginInput = z.infer<typeof loginSchema>;
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
/** @deprecated use ContactCreateInput */
export type GuestCreateInput = ContactCreateInput;
export type AudienceCreateInput = z.infer<typeof audienceCreateSchema>;
export type AudienceUpdateInput = z.infer<typeof audienceUpdateSchema>;
export type AudienceMembershipInput = z.infer<typeof audienceMembershipSchema>;
export type AudienceKind = z.infer<typeof audienceKindSchema>;
export type ContactSource = z.infer<typeof contactSourceSchema>;
export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type TestMessageInput = z.infer<typeof testMessageSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
