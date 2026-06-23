-- Defense-in-depth: enable Row Level Security on every table with NO policies.
-- With RLS on and no policies, all access is DENIED to the Supabase `anon` and
-- `authenticated` API roles (PostgREST / supabase-js), so the public Supabase
-- Data API cannot read or write any row. The application server connects as the
-- table owner (the `postgres` role via the session pooler), which BYPASSES RLS,
-- so its own queries are unaffected. Net effect: data is reachable ONLY through
-- our API, never through Supabase's auto-generated public data API.
ALTER TABLE "attorneys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
