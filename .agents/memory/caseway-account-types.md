---
name: Caseway account types (solo vs firm)
description: How the solo/firm listing cap is modeled, enforced, and why route-test mocks must track the POST /attorneys auth dependency.
---

# Caseway account types (solo vs law firm)

Attorney accounts carry an account type that caps how many listings they may hold:
**solo = one active listing, firm = many.** Solo can upgrade to firm later for free,
self-serve.

## Where it lives
- Stored in Supabase Auth `user_metadata.accountType` ("solo" | "firm"), same pattern
  as `referrerAttorneyId`. **Client-writable metadata is acceptable here** because the
  upgrade is free and explicitly allowed — it is a product/UX gate, not a paywall.
- **Missing/invalid => treated as "solo" (restrictive).** Only an exact `"firm"` is a firm.

## Enforcement (authoritative = server)
- The cap is enforced at `POST /attorneys`, NOT on the client (client just shows a
  friendly gate/upgrade panel).
- "Active" listing for the cap = `archivedAt IS NULL` AND `status != 'rejected'`, so a
  rejected or archived listing frees the slot.
- **Why the advisory lock:** the count-then-insert runs inside one `db.transaction` behind
  `pg_advisory_xact_lock(hashtextextended(ownerId, 0))` so two concurrent solo creates
  can't both pass the check and double-insert. The lock is per-owner and released at tx end.
- The 409 uses `{ error, code: "solo_listing_limit" }`; the client reads the `code`
  generically (no OpenAPI/codegen change — accountType never enters any API req/resp).

## Test gotcha (the one that bit us)
Route tests `vi.mock("../lib/supabaseAuth", ...)`. `POST /attorneys` was switched from
`getAuthUserId` to **`getAuthUser` + `getAccountType`**. Any mock of that module MUST export
all three or POST throws (undefined call) and returns 500 instead of 401/201, silently
breaking unrelated owner/referral/pause tests.

**How to apply:** in route-test mocks, default the mocked user to `"firm"` (unlimited) so
existing multi-listing-per-owner cases (e.g. the self-referral test creating two listings
for one owner) keep passing; pass `"solo"` only in the dedicated cap test.
