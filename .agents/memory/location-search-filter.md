---
name: Attorney location search (q filter) matching
description: How the directory's `q` location filter must match Google-autocomplete location strings against attorney office addresses.
---

# Location search matching

## Primary path: geographic radius (when coordinates resolve)

The home discovery search is **radius-based, not text-based**. When the Google
Places autocomplete (or `resolveCoords`) yields coordinates for the typed
location, the client drops the `q` param entirely, fetches the whole approved
directory, and filters client-side to attorneys whose office is within
`SEARCH_RADIUS_MILES` (haversine), sorted nearest-first.

**Why:** a nearby town rarely appears verbatim in an attorney's address — e.g.
searching "Trumbull" returned 0 even though dozens of Fairfield County attorneys
sit inside the 25-mile circle drawn on the map. The visible map circle and the
result filter MUST share one constant (`lib/geo.ts` `SEARCH_RADIUS_MILES` /
`SEARCH_RADIUS_METERS`) so they never diverge.

**How to apply:** radius filter lives in the `attorneys` memo in `pages/home.tsx`;
the circle in `components/attorney-map.tsx` uses the same constant. Fetch-all +
client-filter is fine for the current small directory but won't scale to a large
dataset — at that point add a server geo endpoint (`lat`/`lng`/`radiusMiles`,
SQL bounding-box/PostGIS).

## Fallback path: server `q` text filter (no coordinates)

Only used when geocoding is unavailable (e.g. no `VITE_GOOGLE_MAPS_API_KEY`).
The autocomplete sets `locationStr` to a formatted string like
`"New York, NY, USA"`, sent verbatim as `q`; category filtering is client-side.

**Rule:** the server `q` filter must NOT substring-match the whole string against the
attorney haystack. Split `q` on commas, drop country tokens (`usa`, `us`,
`united states`, ...), then require every remaining part to match on **word
boundaries** (`\bterm\b`).

**Why:**
- Whole-string substring (`haystack.includes("new york, ny, usa")`) never matches any
  office address → location search silently returned 0 results for every city.
- Plain substring of short tokens (e.g. `"ny"`) matches inside unrelated words like
  `"attorney"`, so a bare state query matched everyone. Word boundaries fix this.

**How to apply:** lives in `matchesFilters` in
`artifacts/api-server/src/routes/attorneys.ts`. If you add fields to the search
haystack or change autocomplete output, keep the comma-split + word-boundary +
country-drop behavior. The api-server dev workflow does not always hot-reload route
changes — restart `artifacts/api-server: API Server` before curl-verifying.

## By-name typeahead: separate `name` param (substring, NOT `q`)

The landing page also has a "search attorney by name" typeahead. It uses a
DISTINCT `name` query param, not `q`.

**Rule:** do not reuse `q` for the name typeahead. `q` matches on **word
boundaries** (whole words), so a partial like "joh" never matches "John". The
`name` param matches a plain case-insensitive substring (`fullName ~* re OR
firmName ~* re`, `re = escapeRegExp(name.trim()).slice(0,80)`) so partial typing
surfaces results. It stacks as another AND on top of the approved/demo/archived
visibility gate, so it can only narrow the public set (no leakage).

**How to apply:** client component `components/attorney-name-search.tsx`
(debounced 250ms, `useListAttorneys({name})` enabled at >=2 chars, click ->
`attorneyPath`). Server condition is in the `/attorneys` handler in
`routes/attorneys.ts`. The api-server dev workflow is esbuild-bundled and does
NOT hot-reload — restart it before curl-verifying route changes.

## Restricting search granularity (town/city or finer only)

The client search box must never resolve to a county/state/country — only a
town/city or something more specific (street address, POI, zip). Enforced by
`isCityOrNarrowerPrediction(types)` in `lib/geocode.ts`, applied via an opt-in
`excludeBroadRegions` prop on `AddressAutocomplete` (Home passes it; the attorney
office-address reuse does NOT, so its behavior is unchanged).

**Rule:** allow if `types` contains a city marker
(`locality`/`postal_town`/`sublocality`/`sublocality_level_1`/`neighborhood`/`postal_code`),
else allow only if it contains NO broad type
(`administrative_area_level_1`=state, `administrative_area_level_2`=county,
`country`, `continent`, `colloquial_area`, `archipelago`). "City marker wins"
keeps independent cities (sometimes tagged county-level) allowed. POIs/routes
(no broad type) pass — intentional, they're points smaller than a city.

**Why / gotchas:**
- `PlacePrediction.types` is populated in the autocomplete response itself — no
  extra billed `fetchFields` needed to filter the dropdown.
- Both paths must filter: the dropdown (in `fetchSuggestions`) AND free-text
  Enter (`geocodeAddress(query, lib, { excludeBroadRegions })` picks the first
  passing prediction, returns null → existing not-found error) so a state can't
  be typed-and-Entered to bypass the list.
- Only enforceable when Maps loads; the no-key `q` fallback can't type-filter
  (acceptable — prod has the key).
