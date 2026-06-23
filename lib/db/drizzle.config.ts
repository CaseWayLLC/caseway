import { defineConfig } from "drizzle-kit";

// Prefer Supabase (SUPABASE_DB_URL); fall back to Replit's DATABASE_URL.
const connectionString =
  process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Set SUPABASE_DB_URL (preferred) or DATABASE_URL — ensure the database is provisioned",
  );
}

// Paths are relative (NOT path.join(__dirname, ...)). The package scripts always
// run with cwd = lib/db, and drizzle-kit has a bug where an ABSOLUTE `out` makes
// it read existing snapshots at `.` + absolutePath (e.g. `.//home/.../meta/...`),
// which ENOENTs on the 2nd+ migration. Relative paths avoid that.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
