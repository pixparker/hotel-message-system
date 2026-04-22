import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "DATABASE_URL is not set. Export it in your shell or .env before running `pnpm db:migrate`.",
  );
  process.exit(1);
}

// Resolve migrations relative to this file, not CWD, so the script works
// from any working directory (dev from packages/db, container from /app).
const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
await sql.end();
console.log("migrations applied");
