import { City } from "country-state-city";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generates one JSON file per US state listing its towns/cities with
 * coordinates, written to the Caseway web app's public/towns directory. The
 * landing-page town picker fetches the file for the selected state so a user can
 * browse every town and pick one (coords come baked in — no geocoding needed).
 *
 * Run with: pnpm --filter @workspace/scripts run gen:towns
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../artifacts/solomatch/public/towns");

// 50 states + DC (matches US_STATES in the web app's constants).
const STATE_ABBRS = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

interface Town {
  name: string;
  lat: number;
  lng: number;
}

mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const abbr of STATE_ABBRS) {
  const cities = City.getCitiesOfState("US", abbr);
  const seen = new Set<string>();
  const towns: Town[] = cities
    // Drop county-equivalents and other administrative regions (counties,
    // Louisiana parishes, Alaska boroughs / census areas / municipalities) —
    // these are regions, not towns. Real cities (e.g. "Anchorage",
    // "New Orleans") still appear under their plain name.
    .filter(
      (c) =>
        !/\b(county|parish|borough|census area|municipality)\b/i.test(c.name),
    )
    .filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    })
    .map((c) => ({
      name: c.name,
      // ~11m precision is plenty for centering a search; keeps files small.
      lat: Math.round(Number(c.latitude) * 1e4) / 1e4,
      lng: Math.round(Number(c.longitude) * 1e4) / 1e4,
    }))
    .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(resolve(OUT_DIR, `${abbr}.json`), JSON.stringify(towns));
  total += towns.length;
  console.log(`${abbr}: ${towns.length} towns`);
}

console.log(
  `\nWrote ${STATE_ABBRS.length} files, ${total} towns total → ${OUT_DIR}`,
);
