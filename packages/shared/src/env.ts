import { z } from "zod";

const trimmedString = (min = 1) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(min));

const secret = (min = 32) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(
          min,
          `must be at least ${min} characters; generate with: openssl rand -base64 48`,
        ),
    );

const nodeEnv = z
  .enum(["development", "production", "test"])
  .default("development");

export const waProviderSchema = z.enum(["mock", "cloud", "baileys"]);
export type WaProvider = z.infer<typeof waProviderSchema>;

const serverEnvObject = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: trimmedString().pipe(z.string().url()),
  REDIS_URL: trimmedString().pipe(z.string().url()),

  JWT_ACCESS_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: trimmedString().pipe(z.string().url()),
  WEB_ORIGIN: trimmedString().pipe(z.string().url()),

  WA_PROVIDER: waProviderSchema.default("mock"),
  WA_CLOUD_ACCESS_TOKEN: z.string().optional(),
  WA_CLOUD_PHONE_NUMBER_ID: z.string().optional(),
  WA_CLOUD_VERIFY_TOKEN: z.string().optional(),

  BOOTSTRAP_ORG_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export const serverEnvSchema = serverEnvObject.superRefine((v, ctx) => {
  if (v.NODE_ENV === "production") {
    if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_REFRESH_SECRET"],
        message: "must differ from JWT_ACCESS_SECRET in production",
      });
    }
  }
  if (v.WA_PROVIDER === "cloud") {
    for (const key of [
      "WA_CLOUD_ACCESS_TOKEN",
      "WA_CLOUD_PHONE_NUMBER_ID",
      "WA_CLOUD_VERIFY_TOKEN",
    ] as const) {
      if (!v[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `required when WA_PROVIDER=cloud`,
        });
      }
    }
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const webEnvSchema = z.object({
  VITE_DEMO: z
    .union([z.literal("1"), z.literal("0"), z.literal("")])
    .optional()
    .transform((v) => v === "1"),
  VITE_API_URL: z.string().url().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export class EnvValidationError extends Error {
  constructor(
    public scope: "server" | "web",
    public issues: z.ZodIssue[],
  ) {
    super(
      `Invalid ${scope} environment variables:\n${formatIssues(issues)}\n` +
        `Fix the listed variables (see .env.example) and retry.`,
    );
    this.name = "EnvValidationError";
  }
}

export type EnvSource = Record<string, string | undefined>;

declare const process: { env: EnvSource } | undefined;

function nodeEnvSource(): EnvSource {
  if (typeof process === "undefined" || !process.env) {
    throw new Error(
      "loadServerEnv() requires a Node.js runtime. Pass an explicit source in other environments.",
    );
  }
  return process.env;
}

export function loadServerEnv(raw: EnvSource = nodeEnvSource()): ServerEnv {
  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EnvValidationError("server", parsed.error.issues);
  }
  return parsed.data;
}

export function loadWebEnv(raw: Record<string, unknown>): WebEnv {
  const parsed = webEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EnvValidationError("web", parsed.error.issues);
  }
  return parsed.data;
}

export function requireDatabaseUrl(raw: EnvSource = nodeEnvSource()): string {
  const url = raw.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Export it in your shell or .env before running this script.",
    );
  }
  return url;
}
