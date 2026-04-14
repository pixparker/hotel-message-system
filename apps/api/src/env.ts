import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  WA_PROVIDER: z.enum(["mock", "cloud", "baileys"]).default("mock"),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
