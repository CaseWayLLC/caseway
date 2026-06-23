---
name: Caseway brand identifiers (what to rename vs keep)
description: The Caseway brand-string convention — capitalized brand label vs lowercase internal identifiers that must not be renamed.
---

# Caseway brand convention

The product brand is **Caseway** (tagline "Find your way to the right attorney"). There is NO "Counselly" brand — an earlier Counselly rename was reverted; "Counselly" must not reappear anywhere in the codebase.

**Convention:** capitalized `Caseway` = the user-facing brand label (header, footer, titles, meta, copy). lowercase `caseway` = internal identifiers. A brand edit should only touch the capitalized label.

**Internal `caseway` / `solomatch` identifiers that must NOT be renamed (renaming breaks behavior or logs users out, with no user value):**
- web artifact dir/slug stays `solomatch` (`@workspace/solomatch`, previewPath `/`); mobile dir/slug stays `caseway-mobile`
- admin cookie `caseway_admin` (adminAuth.ts)
- CSS class `.caseway-search-tooltip` (index.css ↔ attorney-map.tsx)
- analytics localStorage key `caseway_session_id`
- gmaps global callback `__casewayGmapsInit`
- demoData placeholder calendly slug `caseway-demo` (fake URL, demo seed only)

**Why:** slugs/dirs/internal keys stay stable across any rebrand to avoid logout, broken deep links, and churn. Only the brand label changes.

**Legal entities (two, distinct roles):**
- **CaseWay LLC** (Wyoming LLC) — OWNS/OPERATES the Caseway platform/brand/IP. Note the internal capital W, distinct from the "Caseway" brand label.
- **Indicium Markets Inc.** — COLLECTS/PROCESSES payments (merchant of record) on CaseWay LLC's behalf, via Stripe.

**Rule:** any payment / billing / subscription / cancellation copy must attribute payment *collection* to **Indicium Markets Inc.**, while ownership/operation stays **CaseWay LLC**. Standard phrasing: "collected and processed by Indicium Markets Inc. on behalf of CaseWay LLC." Footer/public client surfaces should scope it to "Attorney listing payments…" so clients don't think they're charged. Payment-attribution copy lives across terms.tsx, refund-policy.tsx, privacy.tsx (§ third-party), footer.tsx, listing-pitch.tsx (FoundingOfferCard — also feeds the signup intake topSlot), listing-success.tsx, dashboard.tsx — keep all consistent when payment copy changes.
**Why:** per the user's corporate structure, Indicium only collects payments; CaseWay LLC owns the product and pays out reps. A new payment surface that omits Indicium is an attribution gap.
