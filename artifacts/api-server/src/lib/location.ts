import { eq } from "drizzle-orm";
import { db, attorneysTable } from "@workspace/db";

export interface DerivedLocation {
  city: string | null;
  county: string | null;
  state: string | null;
  stateCode: string | null;
}

const EMPTY: DerivedLocation = {
  city: null,
  county: null,
  state: null,
  stateCode: null,
};

// Two-letter USPS code -> full state name. Used to expose a human-readable,
// SEO-friendly state name and a clean URL segment (e.g. "connecticut").
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

// "<lowercased city>|<stateCode>" -> county. There is no reliable server-side
// geocoder available (the Google key is referrer-restricted and the Geocoding
// API is disabled), so county is resolved from this explicit lookup. A city
// that isn't listed simply yields a null county and is omitted from county
// landing pages until the map is extended.
const CITY_COUNTY: Record<string, string> = {
  "san francisco|CA": "San Francisco County",
  "los angeles|CA": "Los Angeles County",
  "chicago|IL": "Cook County",
  "new york|NY": "New York County",
  "austin|TX": "Travis County",
  "seattle|WA": "King County",
  // Fairfield County, CT towns (the demo/seed Connecticut set).
  "stamford|CT": "Fairfield County",
  "bridgeport|CT": "Fairfield County",
  "norwalk|CT": "Fairfield County",
  "danbury|CT": "Fairfield County",
  "darien|CT": "Fairfield County",
  "fairfield|CT": "Fairfield County",
  "greenwich|CT": "Fairfield County",
  "monroe|CT": "Fairfield County",
  "new canaan|CT": "Fairfield County",
  "newtown|CT": "Fairfield County",
  "ridgefield|CT": "Fairfield County",
  "shelton|CT": "Fairfield County",
  "stratford|CT": "Fairfield County",
  "trumbull|CT": "Fairfield County",
  "westport|CT": "Fairfield County",
  "wilton|CT": "Fairfield County",
  "bethel|CT": "Fairfield County",
  "brookfield|CT": "Fairfield County",
};

// Office addresses are stored as "<street>, <City>, <ST> <ZIP>". Parse the
// trailing "City" and "ST" segments and resolve the full state + county.
export function deriveLocation(
  officeAddress: string | null | undefined,
): DerivedLocation {
  if (!officeAddress) return { ...EMPTY };
  const parts = officeAddress
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 2) return { ...EMPTY };

  const last = parts[parts.length - 1] ?? "";
  const cityRaw = parts[parts.length - 2] ?? "";
  const codeMatch = last.match(/\b([A-Za-z]{2})\b/);
  const stateCode = codeMatch ? codeMatch[1]!.toUpperCase() : null;
  const state = stateCode ? (STATE_NAMES[stateCode] ?? null) : null;
  const city = cityRaw.length > 0 ? cityRaw : null;
  const county =
    city && stateCode
      ? (CITY_COUNTY[`${city.toLowerCase()}|${stateCode}`] ?? null)
      : null;

  return { city, county, state, stateCode };
}

// Recomputes the structured location columns from each row's officeAddress.
// Idempotent — derives the same values every run. With onlyMissing, it touches
// only rows that have never been derived (city IS NULL), so the startup pass is
// a one-time backfill and a no-op on subsequent boots.
export async function backfillLocations(
  opts: { onlyMissing: boolean } = { onlyMissing: true },
): Promise<{ scanned: number; updated: number; withCounty: number }> {
  const rows = await db
    .select({
      id: attorneysTable.id,
      officeAddress: attorneysTable.officeAddress,
      city: attorneysTable.city,
    })
    .from(attorneysTable);

  let updated = 0;
  let withCounty = 0;
  for (const row of rows) {
    if (opts.onlyMissing && row.city) continue;
    const loc = deriveLocation(row.officeAddress);
    await db
      .update(attorneysTable)
      .set({
        city: loc.city,
        county: loc.county,
        state: loc.state,
        stateCode: loc.stateCode,
      })
      .where(eq(attorneysTable.id, row.id));
    updated += 1;
    if (loc.county) withCounty += 1;
  }

  return { scanned: rows.length, updated, withCounty };
}
