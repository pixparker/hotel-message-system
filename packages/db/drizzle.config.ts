import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Export it in your shell or .env before running drizzle-kit.",
  );
}

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
