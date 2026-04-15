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

export const guestCreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: phoneSchema,
  language: languageSchema,
  roomNumber: z.string().max(20).optional(),
});

export const guestUpdateSchema = guestCreateSchema.partial();

export const templateBodySchema = z.object({
  language: languageSchema,
  body: z.string().min(1).max(4096),
});

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  bodies: z.array(templateBodySchema).min(1),
});

export const recipientFilterSchema = z.object({
  status: z.enum(["checked_in", "checked_out"]).default("checked_in"),
});

export const campaignCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    templateId: z.string().uuid().optional(),
    customBodies: z.record(languageSchema, z.string().min(1).max(4096)).optional(),
    recipientFilter: recipientFilterSchema.default({ status: "checked_in" }),
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

export const hexColorSchema = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color, e.g. #14a77a")
  .transform((v) => (v.startsWith("#") ? v.toLowerCase() : `#${v.toLowerCase()}`));

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

export type LoginInput = z.infer<typeof loginSchema>;
export type GuestCreateInput = z.infer<typeof guestCreateSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type TestMessageInput = z.infer<typeof testMessageSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// --- Streamed events (API → UI via SSE) ---
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

// --- Auth flows (Task 3) ---
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
