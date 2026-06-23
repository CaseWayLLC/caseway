// Geographic helpers for the location-radius search on the discovery page.
// The map draws a circle of this radius around the searched point, and the
// results list is filtered to attorneys whose office falls inside it.

export const SEARCH_RADIUS_MILES = 25;

const METERS_PER_MILE = 1609.344;

export const SEARCH_RADIUS_METERS = SEARCH_RADIUS_MILES * METERS_PER_MILE;

// Great-circle distance in miles between two [lat, lng] points (haversine).
export function distanceMiles(
  a: [number, number],
  b: [number, number],
): number {
  const R = 3958.7613; // Earth's mean radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
