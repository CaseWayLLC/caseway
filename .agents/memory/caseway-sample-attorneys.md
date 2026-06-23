---
name: Caseway sample/seed attorneys vs demo-mode
description: The visible "sample" attorneys are non-demo legacy rows, distinct from the demo-mode feature; how to seed Pro/referral ranking demos.
---

- The "sample" listings (what a user may loosely call "demo accounts") are the ~62 `is_demo=false` legacy/seed attorneys: all `status='approved'`, owned by orphaned Clerk owner ids.
- ARCHIVED PRE-LAUNCH (2026-06-23): all 62 were intentionally bulk-archived (single same-second `archived_at`) to clear legacy data before launch — user-confirmed deliberate. So the public directory is INTENTIONALLY EMPTY (`/api/attorneys`, `/api/stats`, `/api/counties` all return 0/[]). This is NOT a bug — do not "fix" it by un-archiving. They only show publicly when un-archived AND `paid_posts_enabled=false`.
- This is SEPARATE from the demo-mode feature (`is_demo=true` rows gated by `demo_mode_enabled` in `app_settings`). Demo mode is OFF and has 0 rows — it was never generated. Do not conflate the two when a user says "demo accounts".
- The seed attorney NAMES repeat across rows (first/last names are cycled), so multiple distinct attorneys share a `full_name`. Identify and seed by `id`, never by name.

**Why:** When asked to "make some demo accounts Pro / give them referrals", the target is the visible non-demo sample rows, not the dormant demo-mode feature. Keying by name silently hits the wrong rows because names collide.

**How to apply (seeding a ranking demo):**
- `referralCount` (referralCountExpr) counts only non-demo, approved, non-archived referees, so setting `referred_by_id` among the 62 non-demo rows counts with NO flag or code change.
- Search requires a category-group (PRACTICE_AREAS) practice-area intersect AND a 25-mile radius (`SEARCH_RADIUS_MILES`). To show ranking in ONE search, seed Pro/referrals on same-category attorneys clustered within 25mi of one town (Fairfield County, CT towns near Norwalk work — ~6 per category there).
- Public ranking order = Pro first, then referralCount, then distance (server `/attorneys` orderBy + client distance sort in home.tsx must agree). Pro shows a gold "Pro" badge on the card; referralCount is intentionally NOT shown publicly (internal growth metric).
- Run DB scripts from `lib/db/` (pg@8 resolves there), using `SUPABASE_DB_URL`; reset `is_pro`/`referred_by_id` on non-demo rows first for idempotency.
