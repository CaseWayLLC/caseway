import type { Attorney } from "@workspace/api-client-react";

// Sanity-checks a listing's stored map pin against the city/state derived from
// its office address (server-side, exposed as a.city / a.stateCode) plus the
// known signature of placeholder coordinates produced by the demo generator.
//
// There is no server-side geocoder available, so this is a best-effort heuristic
// that lets admins target the listings most likely to have a wrong pin before
// running a bulk re-geocode. It never mutates anything.

export type PinHealth = {
  flagged: boolean;
  reasons: string[];
};

// Great-circle distance in km between two coordinates (Haversine).
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Centroid = { lat: number; lng: number };

// City centroids keyed by "<lowercased city>|<stateCode>". Covers the Fairfield
// County demo towns (mirrors TOWNS in api-server demoData.ts) plus the major
// cities the directory knows about (mirrors CITY_COUNTY in api-server
// location.ts). Used to flag pins that sit far from the listing's own city.
const CITY_CENTROIDS: Record<string, Centroid> = {
  // Fairfield County, CT demo towns.
  "stamford|CT": { lat: 41.0534, lng: -73.5387 },
  "bridgeport|CT": { lat: 41.1792, lng: -73.1894 },
  "norwalk|CT": { lat: 41.1177, lng: -73.4082 },
  "danbury|CT": { lat: 41.3948, lng: -73.454 },
  "greenwich|CT": { lat: 41.0262, lng: -73.6282 },
  "fairfield|CT": { lat: 41.1408, lng: -73.2613 },
  "westport|CT": { lat: 41.1415, lng: -73.3579 },
  "trumbull|CT": { lat: 41.2428, lng: -73.2007 },
  "shelton|CT": { lat: 41.3165, lng: -73.0932 },
  "stratford|CT": { lat: 41.1845, lng: -73.1332 },
  "darien|CT": { lat: 41.0787, lng: -73.469 },
  "new canaan|CT": { lat: 41.1468, lng: -73.4948 },
  "ridgefield|CT": { lat: 41.2814, lng: -73.4982 },
  "wilton|CT": { lat: 41.1956, lng: -73.4376 },
  "monroe|CT": { lat: 41.3326, lng: -73.2076 },
  "newtown|CT": { lat: 41.4137, lng: -73.3035 },
  "bethel|CT": { lat: 41.3712, lng: -73.414 },
  "brookfield|CT": { lat: 41.4834, lng: -73.4051 },
  // Major cities the directory maps to counties.
  "san francisco|CA": { lat: 37.7749, lng: -122.4194 },
  "los angeles|CA": { lat: 34.0522, lng: -118.2437 },
  "chicago|IL": { lat: 41.8781, lng: -87.6298 },
  "new york|NY": { lat: 40.7128, lng: -74.006 },
  "austin|TX": { lat: 30.2672, lng: -97.7431 },
  "seattle|WA": { lat: 47.6062, lng: -122.3321 },
};

// Approximate bounding boxes per USPS state code. Used only as a coarse "is the
// pin even in the right state" check, so generous margins are fine.
const STATE_BOUNDS: Record<
  string,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  AL: { minLat: 30.1, maxLat: 35.1, minLng: -88.5, maxLng: -84.8 },
  AK: { minLat: 51.0, maxLat: 71.5, minLng: -179.2, maxLng: -129.9 },
  AZ: { minLat: 31.3, maxLat: 37.1, minLng: -114.9, maxLng: -109.0 },
  AR: { minLat: 33.0, maxLat: 36.5, minLng: -94.7, maxLng: -89.6 },
  CA: { minLat: 32.5, maxLat: 42.1, minLng: -124.5, maxLng: -114.1 },
  CO: { minLat: 36.9, maxLat: 41.1, minLng: -109.1, maxLng: -102.0 },
  CT: { minLat: 40.9, maxLat: 42.1, minLng: -73.8, maxLng: -71.7 },
  DE: { minLat: 38.4, maxLat: 39.9, minLng: -75.8, maxLng: -75.0 },
  DC: { minLat: 38.7, maxLat: 39.1, minLng: -77.2, maxLng: -76.9 },
  FL: { minLat: 24.4, maxLat: 31.1, minLng: -87.7, maxLng: -79.9 },
  GA: { minLat: 30.3, maxLat: 35.1, minLng: -85.7, maxLng: -80.8 },
  HI: { minLat: 18.8, maxLat: 22.3, minLng: -160.3, maxLng: -154.7 },
  ID: { minLat: 41.9, maxLat: 49.1, minLng: -117.3, maxLng: -111.0 },
  IL: { minLat: 36.9, maxLat: 42.6, minLng: -91.6, maxLng: -87.4 },
  IN: { minLat: 37.7, maxLat: 41.8, minLng: -88.2, maxLng: -84.7 },
  IA: { minLat: 40.3, maxLat: 43.6, minLng: -96.7, maxLng: -90.1 },
  KS: { minLat: 36.9, maxLat: 40.1, minLng: -102.1, maxLng: -94.5 },
  KY: { minLat: 36.4, maxLat: 39.2, minLng: -89.6, maxLng: -81.9 },
  LA: { minLat: 28.8, maxLat: 33.1, minLng: -94.1, maxLng: -88.8 },
  ME: { minLat: 42.9, maxLat: 47.6, minLng: -71.2, maxLng: -66.8 },
  MD: { minLat: 37.8, maxLat: 39.8, minLng: -79.6, maxLng: -75.0 },
  MA: { minLat: 41.1, maxLat: 42.9, minLng: -73.6, maxLng: -69.8 },
  MI: { minLat: 41.6, maxLat: 48.4, minLng: -90.5, maxLng: -82.3 },
  MN: { minLat: 43.4, maxLat: 49.5, minLng: -97.3, maxLng: -89.4 },
  MS: { minLat: 30.1, maxLat: 35.1, minLng: -91.7, maxLng: -88.0 },
  MO: { minLat: 35.9, maxLat: 40.7, minLng: -95.9, maxLng: -89.0 },
  MT: { minLat: 44.3, maxLat: 49.1, minLng: -116.1, maxLng: -103.9 },
  NE: { minLat: 39.9, maxLat: 43.1, minLng: -104.2, maxLng: -95.2 },
  NV: { minLat: 35.0, maxLat: 42.1, minLng: -120.1, maxLng: -114.0 },
  NH: { minLat: 42.6, maxLat: 45.4, minLng: -72.6, maxLng: -70.5 },
  NJ: { minLat: 38.8, maxLat: 41.4, minLng: -75.6, maxLng: -73.8 },
  NM: { minLat: 31.2, maxLat: 37.1, minLng: -109.1, maxLng: -102.9 },
  NY: { minLat: 40.4, maxLat: 45.1, minLng: -79.9, maxLng: -71.8 },
  NC: { minLat: 33.7, maxLat: 36.7, minLng: -84.4, maxLng: -75.4 },
  ND: { minLat: 45.8, maxLat: 49.1, minLng: -104.1, maxLng: -96.5 },
  OH: { minLat: 38.3, maxLat: 42.4, minLng: -84.9, maxLng: -80.5 },
  OK: { minLat: 33.6, maxLat: 37.1, minLng: -103.1, maxLng: -94.4 },
  OR: { minLat: 41.9, maxLat: 46.4, minLng: -124.7, maxLng: -116.4 },
  PA: { minLat: 39.6, maxLat: 42.4, minLng: -80.6, maxLng: -74.6 },
  RI: { minLat: 41.0, maxLat: 42.1, minLng: -71.9, maxLng: -71.0 },
  SC: { minLat: 32.0, maxLat: 35.3, minLng: -83.5, maxLng: -78.4 },
  SD: { minLat: 42.4, maxLat: 46.0, minLng: -104.1, maxLng: -96.4 },
  TN: { minLat: 34.9, maxLat: 36.8, minLng: -90.4, maxLng: -81.6 },
  TX: { minLat: 25.7, maxLat: 36.6, minLng: -106.8, maxLng: -93.4 },
  UT: { minLat: 36.9, maxLat: 42.1, minLng: -114.1, maxLng: -108.9 },
  VT: { minLat: 42.6, maxLat: 45.1, minLng: -73.5, maxLng: -71.4 },
  VA: { minLat: 36.5, maxLat: 39.5, minLng: -83.7, maxLng: -75.1 },
  WA: { minLat: 45.5, maxLat: 49.1, minLng: -124.9, maxLng: -116.9 },
  WV: { minLat: 37.1, maxLat: 40.7, minLng: -82.7, maxLng: -77.7 },
  WI: { minLat: 42.4, maxLat: 47.4, minLng: -92.9, maxLng: -86.8 },
  WY: { minLat: 40.9, maxLat: 45.1, minLng: -111.1, maxLng: -104.0 },
};

// The demo generator offsets each town centroid by a multiple of this step
// (range +/- 3 steps) on both axes. Coordinates that sit exactly on that grid
// near a known town are placeholder/jittered demo pins, not real addresses.
const JITTER_STEP = 0.0035;
const JITTER_MAX = JITTER_STEP * 3 + 1e-9;
// Demo coords are exact doubles (town centroid + k * step), so a tight tolerance
// matches them while making a real address landing on the grid effectively
// impossible (window of ~0.1 m per axis).
const JITTER_TOL = 1e-6;

function isJitterMultiple(delta: number): boolean {
  if (Math.abs(delta) > JITTER_MAX) return false;
  const steps = delta / JITTER_STEP;
  return Math.abs(steps - Math.round(steps)) <= JITTER_TOL / JITTER_STEP;
}

function looksLikeDemoPlaceholder(lat: number, lng: number): boolean {
  for (const c of Object.values(CITY_CENTROIDS)) {
    if (isJitterMultiple(lat - c.lat) && isJitterMultiple(lng - c.lng)) {
      return true;
    }
  }
  return false;
}

// Overall continental + AK/HI bounds for an "is this even in the US" check.
const US_BOUNDS = { minLat: 18.0, maxLat: 71.5, minLng: -179.2, maxLng: -66.8 };

// Distance (km) beyond which a pin is considered to be in the wrong city.
const CITY_RADIUS_KM = 30;
// Margin (degrees) added around a state's bounding box before flagging.
const STATE_MARGIN = 0.15;

export function assessPinHealth(a: Attorney): PinHealth {
  const reasons: string[] = [];
  const { latitude: lat, longitude: lng } = a;

  const invalidCoords =
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0) ||
    lat < US_BOUNDS.minLat ||
    lat > US_BOUNDS.maxLat ||
    lng < US_BOUNDS.minLng ||
    lng > US_BOUNDS.maxLng;

  if (invalidCoords) {
    reasons.push("Coordinates are not a valid US location");
    return { flagged: true, reasons };
  }

  const stateCode = a.stateCode?.toUpperCase() ?? null;
  const bounds = stateCode ? STATE_BOUNDS[stateCode] : undefined;
  if (bounds && a.state) {
    const outside =
      lat < bounds.minLat - STATE_MARGIN ||
      lat > bounds.maxLat + STATE_MARGIN ||
      lng < bounds.minLng - STATE_MARGIN ||
      lng > bounds.maxLng + STATE_MARGIN;
    if (outside) reasons.push(`Pin falls outside ${a.state}`);
  }

  const cityKey =
    a.city && stateCode ? `${a.city.toLowerCase()}|${stateCode}` : null;
  const centroid = cityKey ? CITY_CENTROIDS[cityKey] : undefined;
  if (centroid) {
    const km = distanceKm(lat, lng, centroid.lat, centroid.lng);
    if (km > CITY_RADIUS_KM) {
      reasons.push(`Pin is ${Math.round(km)} km from ${a.city}`);
    }
  }

  if (reasons.length === 0 && looksLikeDemoPlaceholder(lat, lng)) {
    reasons.push("Placeholder demo coordinates");
  }

  return { flagged: reasons.length > 0, reasons };
}
