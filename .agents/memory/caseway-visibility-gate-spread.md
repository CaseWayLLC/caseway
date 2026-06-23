---
name: Caseway visibility gate spread across read paths
description: The paid-posts + demo visibility gate must be applied to EVERY public read path; lists where they live and the easy-to-miss one.
---

# Caseway public visibility gate is spread across many read paths

The "is this listing publicly visible?" rule is enforced in MULTIPLE places, not one. Any change to visibility rules (paid-posts, demo, archived) must be made in ALL of them or some surface leaks/hides rows inconsistently.

Two flags drive it, both in api-server `lib/settings.ts`: `getDemoMode()` and `getPaidPostsEnabled()`. `paid_posts_enabled` defaults FALSE (enforcement off → all approved, non-archived listings show, demo-aware); when TRUE, non-demo rows need `subscriptionStatus in ('active','trialing')`. Demo rows are always demo-flag gated, never subscription gated. Archived rows are always excluded.

Read paths that MUST stay in sync live in TWO files: `routes/attorneys.ts` (the list / single-row / similar / stats / counties reads) and `routes/seo.ts` (the `/sitemap.xml` queries). **The sitemap is the easy-to-miss one** — it's a separate file from the directory reads, so adding a new visibility rule to attorneys.ts without also updating seo.ts silently leaks hidden/unsubscribed URLs into the sitemap.

**Why:** the model is "every public read enforces the gate." A read path that forgets it either exposes hidden/unsubscribed listings (sitemap leaking profile URLs) or hides visible ones.

**How to apply:** when touching visibility, grep for `getPaidPostsEnabled` AND `getDemoMode` and confirm every call site (currently attorneys.ts + seo.ts) applies the same matrix. The SQL-level filter and the row-level `hidden` check must agree.

## Known billing limitation (pre-production)
- The Founding-tier cap (first 10k attorneys, `isFoundingAvailable()`) is a pre-check only — concurrent checkout sessions can oversubscribe it. Immaterial pre-launch (~62/10k, Stripe not connected yet); harden before production (post-check/reconcile or DB-backed reservation).
- `reconcileBilling` on an inactive sub (canceled/past_due/unpaid/incomplete) sets the real inactive status + `isPro=false` (so it drops from public reads) but intentionally KEEPS the last status/tier on the row for the owner's dashboard — it does not null every billing field.
