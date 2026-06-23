---
name: Google Places autocomplete for new Google Cloud accounts
description: Why classic google.maps.places.Autocomplete fails (403) for accounts created after March 2025 and what to use instead.
---

# Google Places autocomplete — new accounts must use the New Places API

For Google Cloud projects/billing accounts first used after **March 1, 2025**
("new customers"), the legacy Places endpoints are denied. Symptoms:
- `google.maps.places.Autocomplete` (the classic widget) renders but returns no
  suggestions; network shows a **403** on the autocomplete request.
- Console prints the generic deprecation notice "Autocomplete is not available to
  new customers…" — note this warning shows for *everyone*, so its presence alone
  does not prove breakage; the 403 is the real signal.

**Use the New Places API instead:**
- `const lib = await google.maps.importLibrary("places")` then
  `lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, includedRegionCodes, sessionToken })`
  and render your own dropdown (full styling control), or use
  `PlaceAutocompleteElement` (less styling control).
- On select: `suggestion.placePrediction.toPlace()` →
  `await place.fetchFields({ fields: ["formattedAddress", ...] })`.

**Required Google Cloud setup (user-side, easy to miss):**
- Enable **Places API (New)** = `places.googleapis.com` (library link
  `console.cloud.google.com/apis/library/places.googleapis.com`). This is a
  *different* product from the older "Places API". Also enable **Maps JavaScript API**.
- If the API key has **API restrictions** set, **Places API (New)** must be added
  to that allowlist or calls still 403.

**Why:** lost a round-trip assuming the classic widget would work on a brand-new
key. The deprecation warning was a red herring; the 403 + new-account status was
the actual cause.

**How to apply:** any Google Places autocomplete feature should default to the New
Places API and the agent should proactively tell the user to enable "Places API
(New)" (not just "Places API"). The Vite client reads the key from a
`VITE_`-prefixed secret (`VITE_GOOGLE_MAPS_API_KEY`); restart the web workflow
after the secret is added so Vite injects it.
