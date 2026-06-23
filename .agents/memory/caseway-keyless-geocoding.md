---
name: Caseway keyless geocoding + mandatory location
description: How location search validates without a Google Maps key, and why search always requires resolved coords.
---

# Keyless geocoding fallback (OSM/Nominatim)

`geocodeAddress` (web `src/lib/geocode.ts`) uses Google Places when `VITE_GOOGLE_MAPS_API_KEY` is set, otherwise falls back to the keyless OpenStreetMap **Nominatim** geocoder. So geocoding is ALWAYS available, even with no key.

**Why:** the live site had no Maps key → geocoding was disabled → the landing search would advance with `searchCoords=null`, showing a fully zoomed-out world map. The bug's tell-tale sign in a screenshot is the world-map zoom level.

**How to apply:**
- Landing search (`home.tsx` `handleStartSearch`) ALWAYS requires resolved coords (`if (!coords) resolve...`). Never re-gate this on a "is geocoding available" check — that was the original bug. A county/state/unrecognizable string must be rejected with the "couldn't find that place" error and must not advance.
- `isGeocodingAvailable()` still returns Google-key presence and is intentionally kept ONLY for `admin.tsx` batch geocoding (Google-only, to avoid Nominatim rate limits). Do not rewire admin onto Nominatim.
- Call Nominatim ONCE on submit, never per keystroke (usage policy). There is no autocomplete dropdown without a Google key.
- The browser CANNOT set a custom `User-Agent` (forbidden header); rely on the auto Referer. Nominatim supports CORS.
- Broad-region rejection (`excludeBroadRegions`): accept a result only if it has a locality field (`city/town/village/...`) or a fine `addresstype` (`postcode/road/place/...`); reject `state/county/country`. Verified live: Trumbull→town(accept), Connecticut→state(reject), Fairfield County→county(reject), Stamford CT→city(accept), 06611→postcode w/ town(accept), street→place w/ town(accept), gibberish→0 results(reject).

**Stale-result race:** after the async resolve, compare a mirror ref of the live input (`locationStrRef.current.trim()`) to the captured `query`; if the user edited the input mid-flight, abort without advancing so coords never diverge from the displayed text.

# Keyless autocomplete dropdown (Photon)

The type-ahead dropdown used to be Google-only — `fetchSuggestions` early-returned when the Places lib was null, so with no Maps key there were NO suggestions ("autofill does not work"). Now `searchPlacesKeyless` (geocode.ts) provides keyless type-ahead via **Photon** (`photon.komoot.io/api`).

**Why two different OSM services:** Photon is built for autocomplete (per-keystroke OK, CORS, returns inline coords); Nominatim's usage policy *forbids* per-keystroke autocomplete and is used only for the single on-submit resolve. Do not call Nominatim per keystroke, and do not try to make Photon the submit resolver.

**How to apply:**
- `address-autocomplete.tsx` branches on `placesLibRef.current`: keyless path (min 3 chars) → `searchPlacesKeyless`; Google path (min 2 chars) unchanged. Keyless selections fire the new `onSelectCoords(coords)` prop (Google uses `onSelectPlace`, which can't exist keyless). Consumers (`home.tsx`, `attorney-form.tsx`) wire `onSelectCoords` to set coords/map-pin directly.
- **Picked Photon suggestions carry inline coords and BYPASS the on-submit Nominatim guard.** So `isBroadRegionPhoton` is the ONLY guard for selected suggestions — keep it strict: reject `osm_key === "boundary"` and `type`/`osm_value` in {state,county,country,region,continent}. Enforce US-only with `p.countrycode !== "US"` (not `&&` — missing countrycode must be dropped).
- `fetchSuggestions` bumps `requestIdRef` at the very top (before any early return) so an in-flight response can't repopulate a stale dropdown after the input is cleared/shortened.
- Photon errors return `[]` (graceful: dropdown just shows no results); typed-but-unselected text still hits the Nominatim submit guard.

**Office-address building-number trap (attorney signup):** the `officeAddress` field validates `/^\d/` (must start with a building number — rejects bare town/county/state). But Photon STREET suggestions have no house number — their label is the road name ("North 13th Avenue, Arcadia, Florida, 34266"). Picking one calls `onAddressChange(s.full)`, which OVERWRITES the user's typed "123 ..." with the number-less label → validation fails → user is stuck ("won't let me type a specific address"). Fix: `address-autocomplete.tsx` `preserveTypedHouseNumber()` re-prepends the user's leading building number (`/^\d+[A-Za-z]?/` from the live input value) to the suggestion label when the label lacks one; `searchPlacesKeyless` also builds `"<housenumber> <street>"` when Photon returns a `housenumber`. **Why:** keyless street geocoding rarely returns house-level points, so the canonical suggestion label alone can never satisfy the building-number rule. **Apply to any field that requires a house number while using keyless suggestions.**
