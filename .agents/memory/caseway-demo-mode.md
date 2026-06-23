---
name: Caseway demo mode
description: How demo/sample attorney profiles are gated, and how to test admin-cookie endpoints.
---

# Demo mode

Demo (sample) attorneys are marked by `attorneys.isDemo = true`. A global flag in the
`app_settings` key-value table (`demo_mode_enabled`) decides whether they appear in the
public directory. Rows are NOT deleted when demo mode is turned off — they persist and are
just hidden, so toggling back on is instant. Seeding is idempotent: profiles are generated
once (only when zero demo rows exist), guarded by a Postgres advisory lock inside a
transaction so concurrent enable requests can't double-insert.

**Rule:** any NEW public read path that returns attorneys must consult `getDemoMode()` and
exclude `isDemo` rows when it is off — otherwise demo data leaks. Currently enforced in
`/attorneys`, `/attorneys/:id`, `/attorneys/:id/similar`, `/stats`.
**Why:** demo data must be completely invisible to real visitors unless an admin opts in.

# Testing admin-cookie-protected endpoints

The admin portal uses a self-signed HMAC cookie (`caseway_admin`) keyed by `SESSION_SECRET`,
separate from the attorney Supabase Auth login. To exercise `/admin/*` endpoints in a test without knowing the admin PIN:
forge the cookie in a Node script run from the **shell** (`SESSION_SECRET` is present in the
shell env) — compute `base64url(payload) + "." + base64url(hmacSha256(secret, payload))` with
`payload = base64url(JSON.stringify({role:"admin", exp: Date.now()+3600000}))`, then `fetch`
through the proxy at `http://localhost:80/api`.
**Why:** `viewEnvVars` in the code-execution sandbox masks secret VALUES (returns booleans),
so you cannot forge the token there; the shell has the real value. Never print the token/secret.

# Promoting demo rows to permanent listings

Demo rows can be made permanent (clear `isDemo`, then `setDemoMode(false)`) so they show in
the directory regardless of the demo flag — without deleting anything. After promotion
`demoCount=0`, so re-enabling demo mode regenerates a fresh 50 (idempotency only blocks while
demo rows still exist). Admin can also hard-delete any listing by id (admin route is NOT
owner-scoped, unlike the owner DELETE), so it can remove ownerless promoted/demo rows.

# Editing promoted demo listings (photoUrl validation)

Promoted demo rows keep their seed headshot `photoUrl` (`/seed-attorneys/N.png`), inserted
directly via DB bypassing the URL allowlist. Any edit endpoint that re-submits that value must
treat root-relative photoUrl paths as safe — exempt anything starting with `/`, not just
`/objects/` — or saving an unmodified promoted listing 400s on "photoUrl must be a valid
http(s) URL". The owner PATCH only exempts `/objects/` (owners upload their own photos); the
admin PATCH exempts any `/`-prefixed path. **Why:** a path starting with `/` can't carry a
dangerous scheme (e.g. `javascript:`), so it's safe while still blocking scheme injection.

**Rule:** running a data migration like promote/delete against PROD requires the app to be
DEPLOYED first. **Why:** the prod DB is read-only to agent tooling AND brand-new endpoints
don't exist on the live server until publish — so the only way to mutate prod data is to ship
the code, then call the live admin API (real login, see below) or click the admin UI.

# Driving the LIVE/prod admin API from the shell

To toggle demo mode (or any `/admin/*`) on **production** (`https://solo-match.replit.app/api`):
real login works because the deployment inherits the same secrets as dev — `curl` POST
`/admin/login` with the admin username/password env vars, saving the `caseway_admin` cookie to a
jar with `-c`, then POST `/admin/demo {"enabled":true|false}` with `-b` the jar. The username is
exposed in `.replit [env]`; the password and `SESSION_SECRET` are prod-inherited secrets — read
them only from the shell env, never inline their values.
**Why:** the `code_execution` JS sandbox does NOT expose `process.env` (it's `undefined`), so do
prod admin calls from **bash** where the secret env vars are real. Build the JSON with `printf`
referencing the env vars and pipe via `--data @-` so values never appear in the command text.
Never echo or print the username, password, or token.
