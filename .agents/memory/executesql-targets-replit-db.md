---
name: executeSql/checkDatabase target the Replit DB, not Supabase
description: The code_execution executeSql callback talks to Replit-managed Postgres (DATABASE_URL), not the app's Supabase DB — so it can't see/clean app data.
---

# executeSql targets the Replit DB, not Supabase

This project's app data lives in **Supabase Postgres** (`SUPABASE_DB_URL`), which
`config.ts`/`databaseUrl` resolves with precedence over Replit's reserved
`DATABASE_URL`. But the `executeSql` (and `checkDatabase`) callback in the
code_execution sandbox connects to the **Replit-managed Postgres (`DATABASE_URL`)** —
a *different, mostly-empty* database. A `DELETE`/`SELECT` there silently returns
`DELETE 0` / no rows even when the row exists in Supabase.

**Why:** the Replit tool is wired to the built-in Replit DB, not the app's configured
Supabase connection. They are two separate databases.

**How to apply:** for any ad-hoc read/cleanup of real app data (attorneys, etc.), go
through Supabase, not executeSql:
- `psql "$SUPABASE_DB_URL" -c "..."` from bash (reference the env var — never echo its
  value), or
- a node script that imports the app's drizzle client.
Reserve `executeSql` for quick checks only after confirming which DB it hits (e.g.
`SELECT count(*) FROM attorneys` — if it doesn't match the ~62 legacy rows, you're on
the wrong DB).
