---
name: Caseway firm-account approval
description: How law-firm accounts differ from solo (approval gate + auto-approved listings) and the test gotcha it creates.
---

# Caseway firm-account approval

Two attorney account tiers, chosen at signup (`accountType` in Supabase
`user_metadata`): `solo` (one listing, per-listing admin review, listing inserts
`status="pending"`) and `firm` (unlimited listings, NO per-listing review).

## The approval gate is in app_metadata, not user_metadata
A firm ACCOUNT must be admin-approved before it can post its first listing. That
status is `app_metadata.firmStatus` (`pending`|`approved`|`rejected`), absent =
`pending`.

**Why:** `app_metadata` is writable ONLY by the service-role key. The browser
Supabase SDK (`auth.updateUser` / `auth.signUp`) can write `user_metadata` but
NEVER `app_metadata`, so the account holder cannot forge their own approval.
Firm INFO (name/website/address/phone) is non-sensitive and lives in
`user_metadata`; the approval verdict must not.

**How to apply:** read firm status server-side via `getFirmStatus(user)` in
`lib/supabaseAuth.ts` (the only authoritative check). The client mirror in
`lib/account.ts` is for UI gating only. Admin writes it via
`supabase.auth.admin.updateUserById({ app_metadata: { ...current, firmStatus } })`
(merge, don't clobber other app_metadata keys). POST /attorneys returns 403
`firm_not_approved` when `accountType==="firm" && getFirmStatus !== "approved"`.

## Firm listings INSERT as status="approved" — this breaks "new rows are pending" assumptions
An approved firm's listing skips the solo 1-listing cap and is inserted with
`status="approved"` (goes live right after payment, no review). Solo listings
still insert `pending`.

**Why:** the product promise is "post unlimited attorneys that go live after
payment". The visibility/billing gate is unchanged — an `approved` firm listing
is still only PUBLIC when it also carries an active sub (when paid-posts is on),
so auto-approve does not bypass payment.

**How to apply:** any test or code that assumed a freshly-created listing is
`pending` will break for firm accounts. The pre-existing
`attorneys.{referral,owner-scope,pause-visibility}.test.ts` default `actAs` to
firm (so one owner can hold many rows); after this change they must (a) export
`getFirmStatus` in their `vi.mock` and give firm users
`app_metadata.firmStatus="approved"`, and (b) force a row back to `pending`
(direct DB update) wherever the case genuinely needs an unapproved
referrer/referee or a default-review-state assertion.

## Firms are on custom, sales-managed plans — NO self-serve Stripe checkout
Law firm pricing is custom ("discussed with our sales team"); firms must NEVER be
routed through the standard Founding/Basic/Pro self-serve Stripe flow that solo
attorneys use. Solo flow is unchanged.

**Why:** firm deals are negotiated, so the auto-priced Founding/Basic checkout and
the dashboard Pro upgrade do not apply to them. A firm listing still goes live
purely on approval + publish (the visibility gate only requires an active sub when
`paid_posts_enabled` is ON, at which point sales sets up the custom sub manually).

**How to apply:** the authoritative control is SERVER-SIDE, not UI. `routes/billing.ts`
checkout + upgrade-pro resolve the full user via `getAuthUser` (not `getAuthUserId`)
and return 409 `{code:"firm_custom_plan"}` when `getAccountType(user)==="firm"` —
this guard runs BEFORE the params/listing lookup so it can't be bypassed by a hidden
UI. Mirror it on every client self-serve surface so firms never SEE a dead button:
signup skips `createCheckout` for firms (routes straight to `/listing/success`),
and `dashboard.tsx ListingCard` takes an `isFirm` prop that hides "Complete payment"
+ "Upgrade to Pro" and swaps the approved/unsubscribed copy to a custom-plan message.
Portal/confirm endpoints are left untouched (managing an existing sub is fine).
UI-only gating is insufficient — the server 409 is the real guard.
