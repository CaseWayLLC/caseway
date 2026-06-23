import { lazy } from "react";

// Leaflet + react-leaflet are ~50KB gzipped (~160KB raw) and the map is a
// secondary, below-the-list element on the directory/SEO pages. Loading it
// lazily keeps Leaflet out of each route's initial bundle (mirrors home.tsx,
// where the map only mounts after a search). Wrap usages in <Suspense>.
export const AttorneyMap = lazy(() =>
  import("@/components/attorney-map").then((m) => ({ default: m.AttorneyMap })),
);
