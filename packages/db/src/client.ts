import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  if (_db) return _db;
  _client = postgres(databaseUrl, { max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
