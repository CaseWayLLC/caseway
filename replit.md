# Caseway

A Zillow-style web app for finding solo and independent attorneys ("Caseway — Find your way to the right attorney"). Clients answer a couple of plain-language questions, then browse matching lawyers on an interactive map with profile cards; attorneys can list their own practice via a free signup form.

> The web artifact directory/slug is still `solomatch` (the previewPath is `/`); only the product brand was renamed to Caseway.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/solomatch run dev` — run the Caseway web app (use the workflow, not this directly)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run migrate` — apply migrations to the connected database (this is how the Supabase schema was provisioned)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed:stripe` — create/sync the Stripe subscription plan products (Founding/Basic/Pro); run once after the Stripe integration is connected
- `pnpm --filter @workspace/scripts run gen:towns` — regenerate the bundled per-state town dataset in `artifacts/solomatch/public/towns/<ABBR>.json` (from `country-state-city`)
- `pnpm --filter @workspace/scripts run record:walkthrough` — re-record the real screen-capture product demo (`media/caseway-walkthrough.mp4`) by driving the live site with Playwright; the web + api workflows must be running (uses `playwright-core` + the system Chromium, then ffmpeg webm→mp4)
- **Data & storage (Supabase is the single source of truth):** the app reads/writes Supabase Postgres and stores attorney photos in Supabase Storage. Replit is runtime only; GitHub is canonical code.
  - Required env: `SUPABASE_DB_URL` — the Postgres connection string. It takes precedence over Replit's reserved, auto-populated `DATABASE_URL` (kept only as a fallback; `config.ts`/`databaseUrl` resolves `SUPABASE_DB_URL ?? DATABASE_URL`). Use the **Session pooler** host (`aws-1-us-west-2.pooler.supabase.com:5432`, user `postgres.<project-ref>`), NOT the Direct host `db.<ref>.supabase.co` (IPv6-only, unreachable from Replit → ENOTFOUND) and NOT the transaction pooler (6543). The pooler accepts a plain connection — no SSL config needed (server is PG 17.6).
  - Storage env: `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (service-role key, server-only — NEVER exposed to the browser) drive `lib/supabaseStorage.ts`. Photos live in the PRIVATE bucket `attorney-photos` (`SUPABASE_STORAGE_BUCKET`, default), restricted to `image/jpeg|png|webp` and ≤10MB. Uploads use short-lived signed PUT URLs; reads are proxied through `GET /api/storage/objects/*` (bytes streamed via the service-role client, with inline-image content-type safety). `SUPABASE_PUBLISHABLE_KEY` (anon) is unused server-side — all DB/storage access is server-mediated; the anon key is intentionally never given browser DB access.
  - **Auth (Supabase Auth, email+password only):** attorney accounts live in Supabase Auth (same project as storage/DB). The browser client (`src/lib/supabase.ts`) uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (shared, non-secret, client-exposed) and registers `setAuthTokenGetter` so API calls carry the current access token. The server verifies that bearer token with the service-role client in `lib/supabaseAuth.ts` (`getAuthUserId`, `supabase.auth.getUser(token)` + short-TTL cache). Public browsing is account-free; only listing management is gated (owner-scoped via `ownerId`). **Manual Supabase dashboard setup (user must do — agent has no Management PAT):** enable the Email provider + email confirmations, set the confirmation/OTP email template to include `{{ .Token }}` (the app verifies a 6-digit OTP, not a magic link), set Site URL + redirect URLs, and configure SMTP for production delivery. Code is resilient if confirmations are OFF (signUp returns a session → straight to `/signup`). **Dead config (user can delete):** the `CLERK_*` secrets are no longer read. Legacy 62 attorneys keep their old Clerk owner-id strings (orphaned, acceptable — no real users).
  - **Hardening:** RLS is enabled on all tables with ZERO policies (deny-by-default). The server connects as the owner role and bypasses RLS; the anon key (if ever used in a browser) is denied everything. The bucket is private — never make it public.
  - **TODO (user):** rotate the Supabase DB password (it was shared in chat during setup) and update the `SUPABASE_DB_URL` secret with the new password.
- The landing search is TWO searchable dropdowns: pick a **US state** first, then a **town** within it. The town list is a bundled per-state dataset (`public/towns/<ABBR>.json`, coords baked in) — picking a state auto-populates the FULL, browsable list of every town in that state (rendered virtualized via `@tanstack/react-virtual`; typing filters it), and picking a town sets the search coordinates directly with **no geocoding**. Regenerate the dataset with `gen:towns`.
- Optional env: `VITE_GOOGLE_MAPS_API_KEY` — upgrades only the attorney **signup** form's street-address autocomplete from the keyless OpenStreetMap geocoder to Google Places (Vite client-exposed; restart the web workflow after setting). Needs Google Cloud **Places API (New)** + **Maps JavaScript API** enabled. (The landing town picker no longer geocodes, so the key does not affect it.)
- Server-side GA4 read access (Analytics Data API): `GA4_PROPERTY_ID` (numeric property id, currently 542202072) + `GA4_CREDENTIALS_JSON` (full Google Cloud **service-account** JSON key) — both shared env vars. Lets the server read GA4 metrics (scope `analytics.readonly`). Requires the **Google Analytics Data API** enabled in the Cloud project AND the service-account email added as a **Viewer** under GA Admin → Property access management. Use the name `GA4_CREDENTIALS_JSON` (NOT `GA4_SERVICE_ACCOUNT_JSON` — that legacy secret holds a stale value). Note: the site separately *sends* data to GA4 via gtag in `index.html` (measurement id G-3H3JLLEK1M); this credential is the read path.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Web: React + Vite, wouter (routing), TanStack Query, react-leaflet/Leaflet (map), framer-motion, react-hook-form + zod, shadcn/ui
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` — regenerate hooks/zod after edits
- Generated react-query hooks + types: `@workspace/api-client-react` (barrel import only — no deep imports)
- Generated zod schemas: `@workspace/api-zod`
- DB schema (source of truth): `lib/db/src/schema/attorneys.ts`
- API routes: `artifacts/api-server/src/routes/attorneys.ts`
- Web app: `artifacts/solomatch/src/` (pages `home.tsx`, `signup.tsx`, `listing-success.tsx`; components `attorney-map`, `attorney-card`, `attorney-profile-panel`, `layout`, `logo`)
- Brand mark: `artifacts/solomatch/src/components/logo.tsx` (SVG scales-on-tile) + `public/favicon.svg`
- Attorney marketing pitch: `artifacts/solomatch/src/components/listing-pitch.tsx` (`ListingPitch` + `FoundingOfferCard`) — mirrors the founding-attorney one-pager. Rendered ONLY on the attorney funnel: sign-up/sign-in pages (`App.tsx`) and the signup intake (via the form's `topSlot`). NEVER import it on client discovery pages (home/attorney/county) — clients browsing for a lawyer must not see the sales pitch.
- Seed attorney headshots: `artifacts/solomatch/public/seed-attorneys/1.png`–`12.png`

## Architecture decisions

- Built as a real full-stack app (not a useState demo) so attorney data persists in Postgres.
- `getSimilarAttorneys` has no `limit` query param — combining a path param + query param on one endpoint caused an Orval `*Params` type collision; the server hardcodes top-4 by practice-area overlap.
- Boolean list filters (`freeConsultation`, `videoConferencing`) are read from the raw query string in the route (`=== "true"`), NOT from the coerced zod value — `z.coerce.boolean()` treats `"false"` as truthy.
- Server validates URL fields (`photoUrl`, `calendlyUrl`, `websiteUrl`) against an http(s) scheme allowlist before persisting, to prevent stored unsafe-URL (e.g. `javascript:`) injection.
- The discovery UI uses high-level category groups (e.g. "Family / Relationships") while attorneys store specific practice areas (e.g. "Divorce"). The group→specific mapping lives in `src/lib/constants.ts` (`PRACTICE_AREAS`); category filtering is done client-side in `home.tsx` by intersecting the group's areas with each attorney's areas. The API's `practiceArea` filter matches exact specific areas only.
- **Paid-posts visibility + Pro ranking:** a non-demo listing is publicly visible only while `subscriptionStatus` is active/trialing (paid-posts gate — see "Monetization model"). `attorneys.isPro` (boolean) marks the top "Pro" tier and controls ranking — Pro listings rank ABOVE non-Pro everywhere attorneys are ordered. Ranking tiers are Pro first, then referral count (see "Referrals"), then recency: the `/attorneys` query sorts `desc(isPro), desc(referralCount), desc(id)`, `/attorneys/:id/similar` keeps practice-area overlap as the PRIMARY sort then `desc(isPro)`/`desc(referralCount)`, and the client distance sort in `home.tsx` sorts Pro-first, then higher referral count, then nearest. `isPro` is set automatically by `reconcileBilling` when the active subscription's tier is Pro (and cleared otherwise); an admin can still toggle it manually (`POST /admin/attorneys/:id/pro`, mirrors the `verify` endpoint).

## Listings (pay-at-submission model)

- Intake creates a `status: "pending"` listing (`POST /api/attorneys`, `ownerId` from the signed-in Supabase Auth account) and then **immediately collects payment** — payment is taken at submission, BEFORE admin review (pivoted June 2026 from the earlier free-intake / pay-after-approval paid-posts model).
- A listing becomes PUBLIC only when BOTH are true: an admin approved it (`status = "approved"`) AND it carries an active/trialing Stripe subscription. Because payment is now upfront, a pending listing typically already has an active subscription — it just isn't public until approved. Every public read enforces this gate (see "Paid-posts visibility + Pro ranking" under Architecture decisions). Demo rows (`isDemo`) are exempt from the subscription requirement (gated by demo mode instead).
- Flow: signup submit → `createAttorney` → `createCheckout({ flow: "signup" })` → Stripe Checkout → back to `/listing/success` (`pages/listing-success.tsx`, which confirms billing) while the listing waits on admin review. If checkout can't start, the listing is still saved and the owner is sent to `/dashboard` to complete payment. After approval the listing goes live automatically (it already carries the sub). Managing/canceling billing goes through the Stripe billing portal; Pro is a dashboard-only upgrade.

## Admin portal

- `/admin` is PIN-gated (see Architecture / admin login). Backend: `artifacts/api-server/src/routes/admin.ts`; UI: `artifacts/solomatch/src/pages/admin.tsx`. Tabs: Applications (approve/reject pending listings), Archived (soft-deleted rows), Accounts, plus the per-listing Pro toggle.
- **Accounts tab** manages attorney **Supabase Auth** accounts — Supabase Auth is the source of truth, there is NO DB accounts/banned table. `GET /admin/accounts?limit&offset` lists every account (email, signup date, last sign-in, ban status, linked listings) via `supabase.auth.admin.listUsers`. `POST /admin/accounts/{id}/ban` (body `{ banned }`) is a reversible suspend that blocks sign-in only (`updateUserById` with a `ban_duration`; listings stay live). `DELETE /admin/accounts/{id}` permanently removes the Supabase user FIRST (`deleteUser`), then best-effort NULLs `ownerId` on that user's listings (listings are kept, just unlinked). All three are `requireAdmin`; Supabase admin errors map 404→404, 429→429, else→502.
- A listing chip on an account jumps to that listing's row in the Applications tab (scroll + brief highlight). Archived listings are shown but NOT clickable — they live in the Archived tab, not `/admin/applications`, so a jump would silently no-op.

## Referrals (referrer ranking + leaderboard)

- Attorneys can name who referred them. The signup form's referral picker writes the chosen attorney to the Supabase `user_metadata.referrerAttorneyId` (set at `signUp`); `signup.tsx` propagates it to `AttorneyInput.referredById` on create. `referredById` is a nullable self-FK on `attorneys` (`ON DELETE SET NULL`, indexed).
- `referredById` is honored ONLY at creation and is IMMUTABLE thereafter: both the owner PATCH (`routes/attorneys.ts`) and the admin PATCH (`routes/admin.ts`) strip it (`const editable = { ...parsed.data }; delete editable.referredById;`). It is INPUT-only — it never appears in any `Attorney` response.
- `resolveReferrer()` (in `routes/attorneys.ts`) validates the self-reported referrer at create time: it is honored only if it points to a real, approved, live (non-demo, non-archived) listing owned by a DIFFERENT account (no self-referral); otherwise it is silently dropped to null (signup never fails on a bad referrer id).
- **referralCount** = the number of an attorney's approved, live (non-demo, non-archived) referees. It is OUTPUT-only and optional on `Attorney`, present on the public discovery reads (list/profile/similar). Computed via `referralCountExpr()`, a correlated subquery. GOTCHA: the outer row MUST be referenced as the literal `"attorneys"."id"`, NOT `${attorneysTable.id}` — in a SELECT-projection context Drizzle renders the latter unqualified as `"id"`, which binds to the inner self-alias and silently makes every count 0 (ORDER BY qualifies it correctly, hence the mismatch). Safe because every caller selects FROM the unaliased attorneys table.
- A higher referralCount boosts search ranking (tier between Pro and recency — see "Paid-posts visibility + Pro ranking"). Pro-first is a PAID promise and always outranks referral count.
- Admin leaderboard: `GET /admin/referrals` (`requireAdmin`, operationId `listReferrals` → `useListReferrals`) ranks referrers by qualifying-referee count (aliased self-join, grouped in JS, sorted by count then name). UI: the admin portal "Referrals" tab (`ReferralsTab` in `admin.tsx`).

## Monetization model (pay-at-submission via Stripe subscriptions)

Pivoted June 2026 to **pay-at-submission**: the attorney pays during signup, BEFORE admin review. Checkout auto-prices (there is NO plan picker on the client): the discounted **Founding $10/mo** while the first 10,000 slots remain, else **Basic $100/mo**. The listing stays `pending` until an admin approves it (typically 3-5 business days), then goes live (it already carries the subscription). **Pro $250/mo** is a dashboard-only upgrade after the fact. On reject or any removal the subscription is canceled going forward, with NO refund. (This supersedes the earlier free-intake / subscribe-after-approval paid-posts model; the visibility gate below is unchanged.) The full billing stack is BUILT; it is pending only the live Stripe connection (the user's own Stripe account, blocked on EIN at the time of writing) before going live — Stripe is connected in test mode and the 3 plans are seeded.

- **Plans** (Stripe products, distinguished by `metadata.tier`; query `stripe.products`/`stripe.prices` — never duplicate Stripe data):
  - **Founding — $10/mo** — discounted founding rate, capped at the first 10,000 attorneys (`isFoundingAvailable()` enforces the cap at checkout).
  - **Basic — $100/mo** — standard public listing.
  - **Pro — $250/mo** — public listing + top ranking (`isPro = true`).
- **Visibility gate:** controlled by the `paid_posts_enabled` flag in `app_settings` (helpers `getPaidPostsEnabled`/`setPaidPostsEnabled` in `lib/settings.ts`, default **false**). When OFF (pre-launch / testing), every approved, non-archived listing is visible regardless of billing (demo rows still follow the demo flag). When ON, a non-demo listing is visible iff `status = "approved"` AND not archived AND `subscriptionStatus in (active, trialing)`; demo rows (`isDemo`) stay exempt. Enforced in every public read in `routes/attorneys.ts` (`approvedVisibleCondition` + the raw-SQL `visibilityFilter` in `/stats` and `/counties`, plus the single-row gates in `/attorneys/:id` and `/similar`).
- **Flow:** intake → `POST /attorneys` (pending) → `POST /attorneys/{id}/billing/checkout` with `{ flow }` (`signup` or `dashboard`), owner-scoped, auto-selecting founding/basic — NOT approved-gated (409 only if the listing is rejected or already has an active sub) → Stripe Checkout → webhook + `reconcileBilling` (or `confirmBilling` in dev) set `subscriptionStatus`/`billingTier`/`isPro`. The success URL branches by `flow` (signup → `/listing/success?billing=success`, dashboard → `/dashboard?billing=success`); cancel → `/dashboard?billing=cancel`. Admin then approves → listing goes live (already carries the sub). **Pro upgrade:** `POST /attorneys/{id}/billing/upgrade-pro` (requires an active sub) updates the subscription item to the Pro price with `create_prorations` + `metadata.tier = pro`, then `syncAndReconcile`. **Cancellation:** admin reject / archive / permanent-delete and owner-delete all call `cancelStripeSubscription(subscriptionId)` (immediate cancel, no refund, best-effort) so a removed listing stops billing going forward. Cancel/past_due/unpaid/incomplete clears `isPro` and drops the listing from public reads (the row keeps its last status/tier for the owner's dashboard view). State survives restart via `syncBackfill({ object: "all" })` then `reconcileBilling` on boot.
- **Code map:** `lib/billing.ts` (`reconcileBilling`, `listPlans`, `getPriceIdForTier`, `isFoundingAvailable`, `cancelStripeSubscription`, `PLAN_CATALOG`, `ACTIVE_SUB_STATUSES`); `webhookHandlers.ts`; `initStripe.ts` (init order `runMigrations` → `getStripeSync` → `findOrCreateManagedWebhook` → `syncBackfill` → `reconcileBilling`, run in background, non-fatal so the API still boots without Stripe); `routes/billing.ts` (plans / checkout / portal / confirm / upgrade-pro, all owner-scoped). Checkout input is `CreateCheckoutSessionInput { flow?: "signup" | "dashboard" }` — the server auto-prices, the client never picks a tier. Subscription metadata carries `{ attorneyId, tier }`; billing columns on `attorneys` (`stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `billingTier`). Seed the plan products with `pnpm --filter @workspace/scripts run seed:stripe`.
- **Firms never self-serve these plans (custom, sales-managed):** the Founding/Basic/Pro self-serve flow above is SOLO-ONLY. Law firm pricing is custom ("discussed with our sales team"). `routes/billing.ts` checkout + upgrade-pro resolve the user via `getAuthUser` and return 409 `{code:"firm_custom_plan"}` when `getAccountType(user)==="firm"` (the guard runs before the listing lookup — the authoritative control). The client mirrors it so firms never see a dead button: signup skips checkout for firms (→ `/listing/success`), and `dashboard.tsx ListingCard` (`isFirm` prop) hides "Complete payment" + "Upgrade to Pro" and shows custom-plan copy. Firm listings still go live on approval + publish; when `paid_posts_enabled` is ON, sales sets up the custom sub manually. Portal/confirm endpoints are unchanged. See `.agents/memory/caseway-firm-accounts.md`.
- **Emails (planned, separate workstream):** approval + go-live notices are custom (need an email service); charge receipt + upcoming-charge reminder can be Stripe-native (enable in Stripe billing settings) or driven off `invoice.paid` / `invoice.upcoming` webhooks.
- **Note:** the gate is OFF by default (`paid_posts_enabled = false`) so all approved listings stay visible during pre-launch/testing. Flip it ON only once Stripe is connected and you are ready to go live (`setPaidPostsEnabled(true)`, or set `app_settings.paid_posts_enabled = 'true'`). Turning it ON hides every approved non-demo listing until its owner subscribes (expected, per the model). For dev visibility before Stripe is connected, keep the flag off (or use demo mode / test-mode checkout). Pay-at-submission collects payment during signup **regardless of** `paid_posts_enabled` — the flag only governs the public-visibility gate, not whether checkout runs. `stripe` + `stripe-replit-sync` live in the ROOT package.json; live keys are entered at publish time, test mode for dev.

## Demo mode

- The admin portal "Demo" tab/UI was removed per user request. The backend demo gating (flag + endpoints) still exists but is no longer reachable from the admin UI; demo visibility stays frozen at whatever the `demo_mode_enabled` flag currently is.
- (Historical) For demos: 50 sample attorneys in Fairfield County, CT used to be toggled on/off from the admin portal ("Demo" tab → switch).
- Demo rows are marked `attorneys.isDemo = true`; visibility is gated by the `demo_mode_enabled` flag in the `app_settings` key-value table (`lib/db/src/schema/settings.ts`).
- Toggling off HIDES demo rows (does not delete them) so toggling back on is instant. Generation is idempotent — the 50 profiles are created only once (advisory-lock-guarded transaction) the first time demo mode is enabled.
- Generator: `artifacts/api-server/src/lib/demoData.ts` (203 area code, real Fairfield County towns with jittered coords, practice areas matching `PRACTICE_AREAS` groups, seed headshots 1–12 cycled). Settings helper: `artifacts/api-server/src/lib/settings.ts`. Admin endpoints: `GET`/`POST /admin/demo`.
- Any new public read path that returns attorneys MUST consult `getDemoMode()` and exclude `isDemo` rows when off (already done in `/attorneys`, `/attorneys/:id`, `/attorneys/:id/similar`, `/stats`).

## Product

- Client discovery flow: pick a state, then a town (two searchable dropdowns) → pick a legal category → see attorneys on a Leaflet map alongside scrollable cards.
- Sliding profile panel (from the right) with full attorney details, "Book Free Consultation" (Calendly), and Similar Lawyers.
- Attorney signup: multi-step form to list a practice (contact, location/jurisdictions, practice areas, languages, fees).

## User preferences

- No emojis in the UI.
- Clean, modern, minimal, trustworthy design.

## Gotchas

- Generated react-query hooks require `queryKey` in the `query` options (Orval + react-query v5). Pass it via the generated helpers, e.g. `getGetAttorneyQueryKey(id)`.
- Do not put a zod `.transform()` in a react-hook-form schema — it splits input vs output types and breaks the resolver generic. Keep the field as its input type and transform in the submit handler.
- Import generated code from the `@workspace/api-client-react` barrel only; deep paths like `.../src/generated/api.schemas` are not exported.
- After editing `openapi.yaml`, run codegen before relying on new hooks/schemas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
