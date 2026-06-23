---
name: Caseway lawyer referrals
description: How attorney referrals work — capture, validation, immutability, ranking boost, and the admin leaderboard.
---

# Caseway referrals (referrer ranking + leaderboard)

Attorneys name who referred them at signup. A nullable self-FK `referredById`
on `attorneys` (`ON DELETE SET NULL`, indexed) links a referee → referrer.

- **Capture:** signup picker → `user.unsafeMetadata.referrerAttorneyId` →
  `signup.tsx` sends it as `AttorneyInput.referredById`. INPUT-only; never in any
  `Attorney` response.
- **Validation (`resolveReferrer`, routes/attorneys.ts):** honored only if it
  points to a real, approved, live (non-demo, non-archived) listing owned by a
  DIFFERENT account (no self-referral). Otherwise silently null — signup never
  fails on a bad referrer id.
- **Immutable after create:** owner PATCH (attorneys.ts) AND admin PATCH
  (admin.ts) both strip it (`delete editable.referredById`). Two separate code
  paths — both have their own strip and their own regression test.
- **referralCount** = count of an attorney's approved/live referees; OUTPUT-only,
  optional on `Attorney`, present on public discovery reads. Computed via
  `referralCountExpr()` — see `drizzle-select-projection-self-alias.md` for the
  literal-`"attorneys"."id"` gotcha that made every count silently 0.
- **Ranking:** higher referralCount boosts search rank, but it is tier-2 —
  Pro-first is a PAID promise and ALWAYS outranks it. Order is
  `desc(isPro), desc(referralCount), desc(id)`. The rule lives in THREE places
  (server /attorneys orderBy, /similar orderBy where overlap stays primary, and
  the home.tsx client distance sort) — a ranking change must touch all three.
- **Leaderboard:** `GET /admin/referrals` (`requireAdmin`) — aliased self-join,
  grouped/sorted in JS by count then name. Admin "Referrals" tab in admin.tsx.

**Why:** referrals reward attorneys who bring others onto the platform with
better placement, without ever undercutting the paid Pro tier.
