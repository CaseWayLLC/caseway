import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Supabase is the source of truth for data. Prefer SUPABASE_DB_URL (Supabase
// Postgres); fall back to Replit's reserved, auto-populated DATABASE_URL.
const connectionString =
  process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Set SUPABASE_DB_URL (preferred) or DATABASE_URL — the Postgres connection string.",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

// A standalone (non-pooled) connection for long-lived LISTEN/NOTIFY work. A
// listening connection must be held open for the lifetime of the subscription,
// so it must NOT come from the shared `pool` (that would permanently consume a
// pool slot). Callers own the returned client: connect it, LISTEN, and
// reconnect on error/end.
export function createListenerClient(): pg.Client {
  return new pg.Client({ connectionString });
}

export * from "./schema";
