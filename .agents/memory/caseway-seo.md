---
name: Caseway SEO (static SPA)
description: How indexable attorney + county pages, head/JSON-LD, and the API sitemap fit together in a no-SSR SPA.
---

# Static-SPA SEO model

Prod web is a static SPA (no SSR), so SEO is done client-side + via the API:
- Real wouter routes (pages receive params via the `component` `({params}) => ...`
  prop, not `useParams`). The indexable page taxonomy is a tree:
  `/directory` (master hub) → `/attorneys/:state` (state hub, lists counties) →
  `/attorneys/:state/:county` (county) → `/attorneys/:state/:county/:area`
  (area-county); plus `/practice-areas/:area` (nationwide area hub) and
  `/attorney/:slug` (profile). wouter v3 matches exactly (no `nest`), so the
  1/2/3-segment `/attorneys/...` routes don't shadow each other regardless of order.
- An imperative `<head>` manager (`src/components/seo.tsx`) mutates-or-creates
  title/meta/canonical/OG/Twitter + JSON-LD `<script>`, and restores prior state
  on unmount. Do NOT mount two `<Seo>` instances on one page concurrently.
- Content pages carry a `BreadcrumbList` (JSON-LD + matching visible nav) following
  the geo tree Home>State>County>(Area|Name); attorney.tsx builds it from a
  `crumbItems[]` and skips levels the listing lacks (`hasState`/`hasCounty` gates).
- Dynamic sitemap is served from the API as XML at `/api/sitemap.xml`
  (`api-server/src/routes/seo.ts`), NOT via OpenAPI/Orval. Approved-only + demo-aware.
  It enumerates the full taxonomy: home, /directory, state hubs + nationwide area
  hubs (rolled up in JS from the county / area-county indexes, max child lastmod),
  county + area-county pages, and attorney profiles. Each attorney `<url>` also
  emits an `<image:image><image:loc>` (needs `xmlns:image` on `<urlset>`); the
  server `resolvePhotoLoc` MUST mirror client `photo.ts resolvePhotoUrl` +
  `seo.ts absoluteImageUrl` (`/objects/`→`/api/storage/objects/`; http(s) passthrough;
  else origin-prefix) or emitted image URLs won't be crawlable.

# Crawlability path

The home page is a multi-step flow — attorney cards only exist in the DOM at the
results step, so crawlers can't reach profiles from `/`. Internal-link path is:
footer "Browse by county" links (on every page, from `GET /counties`) → county
pages render real attorney anchors → attorney pages. Plus the sitemap.

# Hard constraints

- **Client `slugify` (`src/lib/seo.ts`) MUST stay byte-identical to the server
  slugify (`api-server/src/routes/seo.ts`).** Why: sitemap URLs are built server-side;
  if the two drift, emitted sitemap URLs won't match the routes the SPA serves (404s).
  There's no shared package/test enforcing this yet — keep them in sync by hand.
- Attorney path = `<kebab-name>-<id>`; the **trailing numeric id is the source of
  truth** (`parseAttorneyId`). Name is decorative; non-canonical slugs soft-redirect.
- **OG / Twitter / JSON-LD images must be ABSOLUTE URLs** (`absoluteImageUrl`,
  origin-prefixed). Photo paths (`/api/storage/objects/...`, `/seed-attorneys/N.png`)
  are origin-absolute, so they get origin only — no BASE_URL prefix. Crawlers/social
  scrapers reject root-relative image refs.

# FAQ / AEO blocks

- Visible FAQ = `src/components/faq-section.tsx` (`FaqSection`); structured data =
  `faqPageLd(items)` in `src/lib/seo.ts`. Rule: the items rendered MUST equal the
  items passed to the JSON-LD (Google requires FAQ markup to match on-page text).
  County + practice-area-county pages pass `faqItems` to BOTH `<FaqSection>` and
  their `<Seo jsonLd={[...]}>` array, so they stay in sync automatically.
- **Home is the exception with a drift trap:** home doesn't use `<Seo>`, so its FAQ
  exists TWICE — the visible `HOME_FAQ` const in `pages/home.tsx` AND a hand-written
  static `FAQPage` `<script type="application/ld+json">` in `index.html`. Edit BOTH
  together. Static-in-index.html is intentional: non-JS AI crawlers read the Q&A
  even without rendering.
- Framing: Google deprecated FAQ rich results for non-gov/health sites, so the value
  here is AEO (answer engines quoting the Q&A) + user UX — don't promise Google FAQ
  snippets.

# Location data (no geocoding)

city/county/state/stateCode are derived from `officeAddress` by
`api-server/src/lib/location.ts` (geocoding was denied). A `CITY_COUNTY` map covers
the known metros. Auto-filled on create / owner-PATCH / admin-PATCH. Existing rows
are backfilled by a fire-and-forget pass at server startup in `index.ts`
(`onlyMissing`), so a fresh deploy self-heals without an admin action.
**Caveat:** `onlyMissing` skips rows that already have `city` but null `county`, so
expanding the city→county map later won't retroactively fix those rows.
