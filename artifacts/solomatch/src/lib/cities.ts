export interface City {
  name: string;
  state: string;
  coords: [number, number];
}

// The eight most populous U.S. cities. Coordinates are hardcoded so the
// browse-by-city shortcuts work even when no Google Maps key is configured.
export const MAJOR_CITIES: City[] = [
  { name: "New York", state: "NY", coords: [40.7128, -74.006] },
  { name: "Los Angeles", state: "CA", coords: [34.0522, -118.2437] },
  { name: "Chicago", state: "IL", coords: [41.8781, -87.6298] },
  { name: "Houston", state: "TX", coords: [29.7604, -95.3698] },
  { name: "Phoenix", state: "AZ", coords: [33.4484, -112.074] },
  { name: "Philadelphia", state: "PA", coords: [39.9526, -75.1652] },
  { name: "San Antonio", state: "TX", coords: [29.4241, -98.4936] },
  { name: "San Diego", state: "CA", coords: [32.7157, -117.1611] },
];

export function citySlug(city: City): string {
  return `${city.name}-${city.state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findCityBySlug(slug: string): City | undefined {
  return MAJOR_CITIES.find((c) => citySlug(c) === slug);
}
