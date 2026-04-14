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

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./migrations" });
await sql.end();
console.log("migrations applied");
