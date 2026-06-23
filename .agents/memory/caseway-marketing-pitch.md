---
name: Caseway attorney marketing pitch
description: Where the founding-attorney sales pitch lives in the web app and the rule that it must never reach clients
---

# Caseway attorney marketing pitch

The attorney pitch (out-market the big firms / "investment in your own
practice", SEO & AEO "search engine of the future", $100 Basic / $250 Pro
pricing) is mirrored from the marketing one-pager into the web app as a reusable
component: `src/components/listing-pitch.tsx` (`ListingPitch` full section +
`ListingTermsNote` standalone neutral pricing/billing callout).

**Founding offer removed from the UI (June 2026):** per user request ("get rid
of founding offer", disliked the banner), all "$10/mo-forever / first 10,000
attorneys" messaging was stripped from the attorney funnel — the old
`FoundingOfferCard` gold callout was rewritten + renamed to `ListingTermsNote`
(neutral $100/$250 + billing terms), the pitch FEATURE/STEP now state flat $100
pricing, and the `/signup` intake no longer shows ANY pricing banner.
**GOTCHA:** the BACKEND still auto-prices founding $10/mo while the first 10,000
slots remain (see replit.md monetization) — a new attorney may be CHARGED $10
even though the UI now shows $100. UI/backend mismatch by design until the
backend founding pricing is also retired.

**Rule:** it is shown ONLY on the attorney funnel — the pages a person reaches
*after* clicking "List Your Practice":
- `/sign-up` and `/sign-in` (inline `SignUpPage`/`SignInPage` in `App.tsx`) —
  two-column: auth column first in DOM (carries the page `<h1>`), pitch second,
  `lg:order-*` flips the pitch to the left only on wide screens.
- `/signup` intake (`pages/signup.tsx`) — heading is "List Practice"; it no
  longer passes a pricing banner via the form's optional `topSlot` prop (the
  prop still exists on `AttorneyListingForm`, the intake just leaves it empty).

**Why:** clients browsing for a lawyer must never see the sales pitch. Scoping
is enforced purely by *where the component is imported* — there is no runtime
guard. Do NOT import `listing-pitch` into client-facing discovery pages
(`home.tsx`, `attorney.tsx`, `county.tsx`, `attorney-map.tsx`) or into
`edit-listing.tsx` (it shares `AttorneyListingForm` but intentionally omits
`topSlot`).

**Audience copy:** inclusive of solo attorneys AND firms ("a firm listing your
whole team"); never claim listing is "completely free" (the intake subheading
was fixed) and never say "predominantly solo".
