import {
  MapContainer,
  TileLayer,
  GeoJSON as GeoJSONLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Layer, PathOptions } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

// Two-letter code -> full state name, used to recover a state from rows that
// only have stateCode populated (state name is derived server-side and can be
// null on older listings).
export const US_STATE_CODE_TO_NAME: Record<string, string> = {
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
  PR: "Puerto Rico",
};

export type StateCountRow = {
  state?: string | null;
  stateCode?: string | null;
};

export type StateCounts = {
  /** count keyed by lowercased full state name */
  counts: Record<string, number>;
  /** original-cased display name keyed by lowercased name */
  display: Record<string, string>;
  /** highest single-state count (for color scaling) */
  max: number;
  /** states sorted by count desc */
  ranked: { name: string; count: number }[];
  /** listings that resolved to a state */
  placed: number;
  /** listings with no resolvable state */
  unknown: number;
};

export function buildStateCounts(rows: StateCountRow[]): StateCounts {
  const counts: Record<string, number> = {};
  const display: Record<string, string> = {};
  let placed = 0;
  let unknown = 0;

  for (const row of rows) {
    let name = (row.state ?? "").trim();
    if (!name && row.stateCode) {
      name = US_STATE_CODE_TO_NAME[row.stateCode.trim().toUpperCase()] ?? "";
    }
    if (!name) {
      unknown += 1;
      continue;
    }
    const key = name.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
    display[key] = name;
    placed += 1;
  }

  const max = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);
  const ranked = Object.keys(counts)
    .map((key) => ({ name: display[key], count: counts[key] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { counts, display, max, ranked, placed, unknown };
}

// Light -> deep forest green ramp (low -> high signups). Brand hue 150.
const GREEN_RAMP = [
  "hsl(150, 33%, 82%)",
  "hsl(150, 36%, 66%)",
  "hsl(150, 39%, 50%)",
  "hsl(150, 41%, 35%)",
  "hsl(150, 46%, 23%)",
];
const EMPTY_FILL = "#E7E3D9";

export function colorForCount(count: number, max: number): string {
  if (!count) return EMPTY_FILL;
  if (max <= 0) return GREEN_RAMP[0];
  const ratio = count / max;
  if (ratio <= 0.2) return GREEN_RAMP[0];
  if (ratio <= 0.4) return GREEN_RAMP[1];
  if (ratio <= 0.6) return GREEN_RAMP[2];
  if (ratio <= 0.8) return GREEN_RAMP[3];
  return GREEN_RAMP[4];
}

export function SignupHeatmap({
  counts,
  max,
}: {
  counts: Record<string, number>;
  max: number;
}) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}geo/us-states.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GeoJSON.FeatureCollection) => {
        if (active) setGeo(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Re-key the GeoJSON layer whenever the data changes so styles recompute.
  const sig = useMemo(
    () =>
      `${max}|` +
      Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(","),
    [counts, max],
  );

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const name = String(
      (feature?.properties as { name?: string } | undefined)?.name ?? "",
    ).toLowerCase();
    const count = counts[name] ?? 0;
    return {
      fillColor: colorForCount(count, max),
      weight: 1,
      color: "#ffffff",
      fillOpacity: count ? 0.9 : 0.6,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const name = String(
      (feature.properties as { name?: string } | undefined)?.name ?? "",
    );
    const count = counts[name.toLowerCase()] ?? 0;
    layer.bindTooltip(
      `<span style="font-weight:600">${name}</span><br/>${count} ${
        count === 1 ? "listing" : "listings"
      }`,
      { sticky: true, direction: "top" },
    );
  };

  if (failed) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-2xl border border-dashed bg-muted/40 text-sm text-muted-foreground">
        Couldn&apos;t load the US map outline.
      </div>
    );
  }

  if (!geo) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-2xl border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[480px] w-full overflow-hidden rounded-2xl border bg-[#F7F5F0]">
      <MapContainer
        center={[37.8, -96]}
        zoom={4}
        minZoom={3}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#F7F5F0" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        <GeoJSONLayer
          key={sig}
          data={geo}
          style={style}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
    </div>
  );
}
