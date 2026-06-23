---
name: Caseway Supabase auth gating
description: How attorney auth is scoped in Caseway after the Clerk to Supabase Auth migration — public browsing vs accounts, ownership model, verification path, and required dashboard setup.
---

# Caseway auth gating (Supabase Auth, email+password only)

Public browsing is account-free; **listing management requires a Supabase Auth attorney account** (email+password, NO social). Rows are owner-scoped via `ownerId`.

**Why:** Zillow-style public directory — clients browse without accounts, but attorneys must manage their own listing over time, so writes are gated and owner-scoped.

## Verification path (server)
- `lib/supabaseAuth.ts`: a lazy service-role client (`SUPABASE_URL` + `SUPABASE_SECRET_KEY`, the same project as storage/DB). `getAuthUserId(req)` reads `Authorization: Bearer <token>`, calls `supabase.auth.getUser(token)`, short-TTL caches the result (TTL <= token expiry; never cache an invalid token), returns user id or null. No local JWT verification.
- Public reads (`GET /api/attorneys`, `/:id`, `/:id/similar`, `/api/stats`) need no token. Write paths (`POST /api/attorneys`, owner `PATCH`, `/pause`, billing) `await getAuthUserId(req)` and 401 when null.
- There is NO global auth middleware in `app.ts` — auth is enforced per-route. (The old Clerk proxy middleware + `clerkMiddleware` were removed.)
- Admin account management uses `supabase.auth.admin.*`: `listUsers` (paginated, newest-first), `updateUserById({ ban_duration })` to ban/unban, `deleteUser` to remove. Errors map 404->404, 429->429, else->502. NO DB accounts/banned table — Supabase Auth is the source of truth.

## Web (browser)
- `src/lib/supabase.ts`: browser client (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, shared/non-secret), `persistSession` + `autoRefreshToken`, `detectSessionInUrl:false`. Registers `setAuthTokenGetter` once (reads `getSession()`) so `custom-fetch` attaches the current access token to API calls. NOTE: `custom-fetch` is now used by BOTH web and Expo for bearer tokens (its old "never use in web" comment was wrong/removed).
- `src/lib/auth.tsx`: `AuthProvider` exposes `{user, session, loading, isSignedIn, signOut}` via `getSession()` + `onAuthStateChange`; `isSignedIn` is `undefined` while `loading` so route guards wait before redirecting; QueryClient is cleared on user-id change.
- Custom forms (no Clerk widgets): `attorney-sign-in-form.tsx` (`signInWithPassword` -> /dashboard); `attorney-sign-up-form.tsx` (`signUp` with `options.data` metadata; `identities?.length===0` => "already exists"; if `data.session` go straight to /signup else show a 6-digit OTP step via `verifyOtp({type:"signup"})` + resend). Route guards are wouter `<Redirect>` to `/sign-in`.

## Referral metadata
- Signup stores `referrerAttorneyId`/`referrerAttorneyName` in Supabase `user_metadata` (via `signUp` `options.data`); `signup.tsx` reads `user.user_metadata` -> `AttorneyInput.referredById`. Server-side `resolveReferrer` validation is unchanged.

## Manual Supabase dashboard steps (agent CANNOT do — no Management PAT)
Tell the user: enable the Email provider + email confirmations; set the confirmation/OTP email template to include `{{ .Token }}` (the app verifies a 6-digit OTP, not a magic link); set Site URL + redirect URLs; configure SMTP for production delivery. Code is resilient if confirmations are OFF (signUp returns a session -> skip OTP).

## Leftovers
- `CLERK_*` secrets are dead config (agent cannot delete secrets) — tell the user they can remove them. `CLERK_*` env was removed from `config.ts` and the Clerk/`http-proxy-middleware` deps were uninstalled.
- Legacy 62 attorneys keep their old Clerk owner-id strings (orphaned, acceptable — there are no real users; no data migration was needed).

## Self-serve account settings (`/account`)
- A signed-in attorney can change email + password from `pages/account.tsx` entirely client-side via the anon client: `supabase.auth.updateUser({ email })` (requires confirmation — Supabase "secure email change" may need confirming from BOTH old and new addresses) and `updateUser({ password })`. Both sensitive changes first re-authenticate with `signInWithPassword({ email: currentEmail, password })` so an unattended session can't silently repoint the login or password.
- **Self-serve delete + sign-out-everywhere + billing overview EXIST** (server route `routes/account.ts`, owner-scoped via `getAuthUserId`):
  - `DELETE /account` (`deleteOwnAccount`): self-delete means the attorney is LEAVING, so unlike the admin delete (keeps listings live, only nulls ownerId) it ARCHIVES their listings (takes them down). Ordering is load-bearing: cancel active/trialing subs FIRST (any failure -> 502, ABORT before deleting), then archive listings (`COALESCE(archivedAt, now())`) + `isPro=false` + `subscriptionStatus=canceled` + bust aggregate caches, then `supabase.auth.admin.deleteUser`, then best-effort null `ownerId`. **Why this order:** never leave a deleted account that is still billed or still publicly listed.
  - `GET /account/billing` (`getAccountBillingOverview`): aggregates per owned listing from Stripe (subscription retrieve + `invoices.list` capped at 6), per-listing try/catch so one Stripe failure degrades gracefully. NEVER return `stripeCustomerId` to the browser. Stripe v22: `current_period_end` is on the subscription ITEM, not the subscription; price is embedded on the item.
  - UI: delete re-auths with `signInWithPassword` + confirm dialog before mutating, then `signOut({scope:'local'})` (server user is gone, a global signout would just error) + navigate home. "Sign out of all devices" uses `signOut({scope:'global'})`. Day-to-day billing management (cancel/portal/Pro) still lives on `/dashboard`; the overview just links out.

## Force-logout deleted/banned users (client reacts to 401)
- `supabase.auth.admin.deleteUser` (and a ban) revokes the server session/refresh tokens, and `getAuthUserId` stops honoring the access token within its short positive-cache window. BUT supabase-js only notices an invalidated session when it next tries to refresh the token (up to ~1h later), so the deleted/banned user otherwise lingers in a broken signed-in UI.
- **Fix lives client-side, not server-side:** a global TanStack Query handler (`queryCache` + `mutationCache` `onError` in `App.tsx`) calls `supabase.auth.signOut({ scope: "local" })` on any 401 when a local session still exists — logging the user out on their next protected interaction. 401s are also not retried.
- **Why local scope:** the server user may already be gone, so a global signout would just error; clearing local state fires SIGNED_OUT and the route guards redirect.
- **GOTCHA — exclude `/api/admin` 401s:** the admin portal uses a separate PIN cookie, NOT the Supabase bearer. An admin also signed in as an attorney in the same browser would otherwise be bounced when an admin endpoint 401s (e.g. expired PIN). Filter by `ApiError.url.includes("/api/admin")`.

## Two distinct "logins" — don't confuse
- **Admin portal** `/admin`: server-verified PIN (`ADMIN_PIN`) -> HMAC cookie (`SESSION_SECRET`). Separate from attorney auth (see caseway-admin-pin.md).
- **Attorney account** `/sign-in`: Supabase Auth, manages listings at `/dashboard`.

## GOTCHA: raw fetch() bypasses the bearer-token auto-attach
- ONLY the generated `@workspace/api-client-react` client attaches `Authorization: Bearer` (via `setAuthTokenGetter` in custom-fetch). A hand-rolled `fetch("/api/...")` to a protected route sends NO token -> instant ~1ms 401. Symptom seen on the photo-upload (`POST /api/storage/uploads/request-url`).
- **Fix pattern:** before a raw fetch to a protected route, `const { data:{session} } = await supabase.auth.getSession();` and add `Authorization: Bearer ${session.access_token}` when present.
- **Dual-context endpoints:** the photo-upload route is hit from BOTH the attorney form (Supabase bearer) AND the admin portal edit form (PIN cookie — admin is NOT a Supabase user). Such endpoints must accept EITHER `getAuthUserId(req)` OR `isAdminRequest(req)`. Same-origin fetch sends the admin cookie automatically, no client branch needed.
