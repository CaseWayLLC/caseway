---
name: Caseway admin PIN login
description: How admin-portal auth works after switching from username+password to a PIN.
---

Admin portal login is a single **PIN**, verified server-side against `process.env.ADMIN_PIN` (`verifyPin` in `adminAuth.ts`), fail-closed when unset. The signed-cookie session is unchanged: HMAC `caseway_admin` cookie via `SESSION_SECRET` (`createAdminToken`/`requireAdmin`). `/admin/login` accepts `{ pin }`; `AdminSession.username` is now always omitted (kept optional in the schema for back-compat).

`/admin/login` has an in-memory, per-IP brute-force guard (8 fails / 15 min → 429); state is per-process and resets on restart. Documented in OpenAPI as a 429 response.

**Why:** a short PIN is easily brute-forced, so the rate limiter is required, not optional.

**Dead config to know about:** `ADMIN_USERNAME` (shared env) and the `ADMIN_USERNAME`/`ADMIN_PASSWORD` secrets still exist in the environment but are **no longer referenced anywhere** — do not wire them back in. The startup warning in `index.ts` now checks `SESSION_SECRET` + `ADMIN_PIN`.

Testing admin endpoints from shell: forging the HMAC cookie from `SESSION_SECRET` still works (token mechanism unchanged); or `POST /api/admin/login {"pin":...}` to get a real Set-Cookie.
