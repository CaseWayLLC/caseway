const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let mapsPromise: Promise<typeof google> | null = null;
let placesLib: google.maps.PlacesLibrary | null = null;

/** Whether a Google Maps key is configured, so geocoding can run at all. */
export function isGeocodingAvailable(): boolean {
  return Boolean(MAPS_KEY) && typeof window !== "undefined";
}

export function loadGoogleMaps(): Promise<typeof google> | null {
  if (!MAPS_KEY || typeof window === "undefined") return null;
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__casewayGmapsInit";
    (window as unknown as Record<string, unknown>)[callbackName] = () =>
      resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/** Load (and cache) the Places library, or null if Maps is unavailable. */
export async function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary | null> {
  if (placesLib) return placesLib;
  const promise = loadGoogleMaps();
  if (!promise) return null;
  try {
    const g = await promise;
    placesLib = (await g.maps.importLibrary(
      "places",
    )) as google.maps.PlacesLibrary;
    return placesLib;
  } catch {
    return null;
  }
}

// Place types that are BROADER than a town/city — searches must never resolve
// to these. (Google place type reference: administrative_area_level_1 = state,
// level_2 = county.)
const BROAD_REGION_PLACE_TYPES = new Set([
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "continent",
  "colloquial_area",
  "archipelago",
]);

// Markers that prove a prediction is a town/city (or a finer slice of one).
const CITY_OR_NARROWER_MARKERS = new Set([
  "locality",
  "postal_town",
  "sublocality",
  "sublocality_level_1",
  "neighborhood",
  "postal_code",
]);

/**
 * True when a place prediction is a town/city or something MORE specific
 * (street address, establishment, neighborhood, zip) and NOT a broader region
 * like a county, state, or country. Independent cities can carry a county-level
 * tag alongside a city marker, so a present city marker always wins.
 */
export function isCityOrNarrowerPrediction(types: readonly string[]): boolean {
  if (types.some((t) => CITY_OR_NARROWER_MARKERS.has(t))) return true;
  return !types.some((t) => BROAD_REGION_PLACE_TYPES.has(t));
}

/** True when a resolved Google Place's state component matches `stateName`. */
export function placeInState(
  place: google.maps.places.Place,
  stateName: string,
): boolean {
  const comps = place.addressComponents;
  if (!comps) return false;
  const target = stateName.toLowerCase();
  return comps.some(
    (c) =>
      c.types.includes("administrative_area_level_1") &&
      (c.longText?.toLowerCase() === target ||
        c.shortText?.toLowerCase() === target),
  );
}

/**
 * Resolve the best-matching coordinates for a free-text address. Uses the
 * Google Places API when a Maps key is configured, otherwise falls back to the
 * keyless OpenStreetMap / Nominatim geocoder so a search always validates
 * against a real place. Returns [lat, lng] or null when nothing matched. With
 * `excludeBroadRegions`, skips county/state/country matches so a query like
 * "Connecticut" resolves to nothing instead of centering on a whole state.
 */
export async function geocodeAddress(
  query: string,
  lib?: google.maps.PlacesLibrary | null,
  opts?: { excludeBroadRegions?: boolean; stateName?: string },
): Promise<[number, number] | null> {
  if (query.trim().length < 2) return null;
  const stateName = opts?.stateName?.trim();
  // Bias resolution toward the chosen state (unless the text already names it);
  // the actual state is still verified on the result below.
  const scopedQuery =
    stateName && !query.toLowerCase().includes(stateName.toLowerCase())
      ? `${query}, ${stateName}`
      : query;
  const placesLibrary = lib ?? (await loadPlacesLibrary());
  if (placesLibrary) {
    try {
      const { suggestions } =
        await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          {
            input: scopedQuery,
            includedRegionCodes: ["us"],
          },
        );
      const predictions = suggestions
        .map((s) => s.placePrediction)
        .filter((p): p is google.maps.places.PlacePrediction => Boolean(p));
      const candidates = opts?.excludeBroadRegions
        ? predictions.filter((p) => isCityOrNarrowerPrediction(p.types))
        : predictions;
      // Resolve candidates in order, accepting the first that is actually in the
      // required state (when one is set). Cap lookups to keep billing bounded.
      for (const cand of candidates.slice(0, 5)) {
        const place = cand.toPlace();
        await place.fetchFields({
          fields: stateName ? ["location", "addressComponents"] : ["location"],
        });
        if (stateName && !placeInState(place, stateName)) continue;
        const loc = place.location;
        if (loc) return [loc.lat(), loc.lng()];
      }
      return null;
    } catch {
      return null;
    }
  }
  // No Maps key configured — use the keyless OSM fallback so search still
  // requires a real, resolvable city/town/address.
  return geocodeViaNominatim(scopedQuery, opts);
}

// --- Keyless fallback: OpenStreetMap / Nominatim --------------------------
// Used only when no Google Maps key is configured. Called once on search submit
// (never per keystroke) to respect Nominatim's usage policy. OSM attribution is
// already shown on the Leaflet map.

interface NominatimResult {
  lat: string;
  lon: string;
  addresstype?: string;
  address?: Record<string, string>;
}

// address.* keys that prove a result is at least a town/city.
const NOMINATIM_LOCALITY_KEYS = [
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "suburb",
  "city_district",
  "neighbourhood",
  "borough",
  "quarter",
] as const;

// addresstype values that are a town/city or MORE specific (street, zip, etc.).
const NOMINATIM_FINE_ADDRESSTYPES = new Set([
  ...NOMINATIM_LOCALITY_KEYS,
  "postcode",
  "road",
  "residential",
  "house",
  "place",
  "building",
  "amenity",
]);

/** True when a Nominatim result is a town/city or finer (not a county/state). */
function isCityOrNarrowerNominatim(d: NominatimResult): boolean {
  const addr = d.address ?? {};
  if (NOMINATIM_LOCALITY_KEYS.some((k) => addr[k])) return true;
  return d.addresstype ? NOMINATIM_FINE_ADDRESSTYPES.has(d.addresstype) : false;
}

async function geocodeViaNominatim(
  query: string,
  opts?: { excludeBroadRegions?: boolean; stateName?: string },
): Promise<[number, number] | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const results = data as NominatimResult[];
    const stateName = opts?.stateName?.trim();
    const matchesState = (d: NominatimResult) =>
      !stateName ||
      (d.address?.state ?? "").toLowerCase() === stateName.toLowerCase();
    const candidates = opts?.excludeBroadRegions
      ? results.filter(isCityOrNarrowerNominatim)
      : results;
    // Only accept a result that is actually in the required state (when set).
    const pick = candidates.find(matchesState);
    if (!pick) return null;
    const lat = Number.parseFloat(pick.lat);
    const lon = Number.parseFloat(pick.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return [lat, lon];
  } catch {
    return null;
  }
}

// --- Keyless autocomplete: OpenStreetMap / Photon -------------------------
// Powers the type-ahead dropdown when no Google Maps key is configured. Photon
// (photon.komoot.io) is purpose-built for autocomplete, is CORS-enabled, and
// returns coordinates inline so a picked suggestion needs no second lookup.

/** A keyless autocomplete result with its coordinates already resolved. */
export interface KeylessSuggestion {
  id: string;
  /** Bold first line (e.g. the town or street name). */
  primary: string;
  /** Muted second line (e.g. "Stamford, Connecticut"). */
  secondary: string;
  /** Full readable label written into the input when selected. */
  full: string;
  coords: [number, number];
}

interface PhotonProperties {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: { coordinates?: [number, number] };
}

// Photon type/osm_value values that are BROADER than a town/city.
const PHOTON_BROAD_TYPES = new Set([
  "state",
  "county",
  "country",
  "region",
  "continent",
]);

/** True when a Photon result is a county/state/country (or admin boundary). */
function isBroadRegionPhoton(p: PhotonProperties): boolean {
  // Administrative/historic boundaries are regions, never a town/city point.
  if (p.osm_key === "boundary") return true;
  if (p.type && PHOTON_BROAD_TYPES.has(p.type)) return true;
  if (p.osm_value && PHOTON_BROAD_TYPES.has(p.osm_value)) return true;
  return false;
}

/**
 * Keyless type-ahead suggestions for the address box (US only). With
 * `excludeBroadRegions`, counties/states/country boundaries are filtered out so
 * a picked suggestion always resolves to a real, mappable point. Returns an
 * empty list on any error so the input degrades to plain text (submit-time
 * validation still runs via {@link geocodeAddress}).
 */
export async function searchPlacesKeyless(
  query: string,
  opts?: { excludeBroadRegions?: boolean; limit?: number; stateName?: string },
): Promise<KeylessSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const stateName = opts?.stateName?.trim();
  // When a state is chosen, bias the query toward it AND hard-filter results to
  // that state below, so the town list only shows places inside the state.
  const photonQuery = stateName ? `${q}, ${stateName}` : q;
  const displayLimit = opts?.limit ?? 6;
  // Over-fetch when a state filter is active so the post-filter list isn't
  // starved when some of the top raw results fall outside the state.
  const fetchLimit = stateName ? Math.max(displayLimit, 15) : displayLimit;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", photonQuery);
    url.searchParams.set("limit", String(fetchLimit));
    url.searchParams.set("lang", "en");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const feats = data.features;
    if (!Array.isArray(feats)) return [];

    const seen = new Set<string>();
    const out: KeylessSuggestion[] = [];
    for (const f of feats) {
      const p = f.properties ?? {};
      // US only, matching the Google path's includedRegionCodes: ["us"].
      if (p.countrycode !== "US") continue;
      // Scope to the chosen state when one is set (Photon `state` is the full
      // name, e.g. "Connecticut"); drop anything outside it.
      if (
        stateName &&
        (p.state ?? "").toLowerCase() !== stateName.toLowerCase()
      )
        continue;
      if (opts?.excludeBroadRegions && isBroadRegionPhoton(p)) continue;
      const coordsRaw = f.geometry?.coordinates;
      if (!coordsRaw || coordsRaw.length < 2) continue;
      const [lon, lat] = coordsRaw;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      // Prefer a full "123 Main St" label when Photon resolves a house number.
      const streetWithNumber =
        p.housenumber && p.street ? `${p.housenumber} ${p.street}` : null;
      const name =
        streetWithNumber ?? p.name ?? p.street ?? p.city ?? p.postcode;
      if (!name) continue;

      const secondary = [p.city && p.city !== name ? p.city : null, p.state]
        .filter(Boolean)
        .join(", ");
      const full = [
        name,
        p.city && p.city !== name ? p.city : null,
        p.state,
        p.postcode && p.postcode !== name ? p.postcode : null,
      ]
        .filter(Boolean)
        .join(", ");

      const key = `${p.osm_type ?? ""}:${p.osm_id ?? ""}:${name}:${p.state ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: key, primary: name, secondary, full, coords: [lat, lon] });
    }
    return out.slice(0, displayLimit);
  } catch {
    return [];
  }
}
