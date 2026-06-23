---
name: react-leaflet GeoJSON types
description: How to type a react-leaflet GeoJSON choropleth in solomatch without a direct @types/geojson dep.
---

# Typing react-leaflet GeoJSON layers in solomatch

`@types/geojson` exists only transitively (via `@types/leaflet`), so an explicit
`import ... from "geojson"` does NOT resolve from `artifacts/solomatch` source
(pnpm nests it under `@types/leaflet`).

**How to apply:** Use the ambient global `GeoJSON.*` namespace types
(`GeoJSON.FeatureCollection`, `GeoJSON.Feature`) — they're pulled into the program
transitively and are valid in *type* position. But react-leaflet also exports a
**value** named `GeoJSON` (the layer component) which shadows that namespace, so
import the component aliased: `import { GeoJSON as GeoJSONLayer } from "react-leaflet"`.
Then the bare `GeoJSON` name resolves to the ambient type namespace.

**Why:** Avoids adding a direct dependency (the `pnpm add` was timing out on this
monorepo) while keeping full type safety; typecheck passes.

Also: to restyle a `<GeoJSON>` layer when its data/counts change, give it a
`key` derived from the data signature so it remounts — leaflet does not re-run the
`style` callback on prop change otherwise.
