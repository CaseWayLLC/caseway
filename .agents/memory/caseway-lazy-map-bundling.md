---
name: Caseway lazy map / Leaflet bundling
description: Keep Leaflet out of route initial bundles — every page must reach the map through the lazy wrapper.
---

- The Leaflet map (`@/components/attorney-map`, ~50KB gz / ~160KB raw via the `marker-shadow` chunk) must be imported ONLY through `@/components/attorney-map-lazy` (a `React.lazy` wrapper), and rendered inside `<Suspense>`.
- **Why:** Vite/rollup adds a component to a route's *static* dependency graph (and its `index.html` `modulepreload`) if ANY importer reaches it synchronously. A single `import { AttorneyMap } from "@/components/attorney-map"` on one page silently re-bundles ALL of Leaflet into that page's initial load — even while other pages lazy-load it. (This was the bug: the home page lazy-loaded the map, but the county/city/practice-area-county SEO pages imported it statically, eagerly shipping Leaflet to crawlers/first paint.)
- **How to apply:** When adding a map to any new page, import from `attorney-map-lazy` and wrap the render in `<Suspense fallback=...>` inside a fixed-height container (so the fallback causes no layout shift). NEVER add a static `from "@/components/attorney-map"` import. To verify after a change: rebuild and grep `dist/public/index.html` — `marker-shadow` must NOT appear (it should be async-only).
