---
name: Framing a Leaflet search circle under UI overlays
description: Why a fixed zoom clips the radius circle and how to fitBounds with asymmetric padding
---

For the discovery results map, frame the whole search-radius circle with `map.fitBounds`, not a hardcoded zoom level. A fixed zoom cannot guarantee the circle fits across viewports — on a portrait phone it spilled past the top/bottom and got clipped.

Pattern: `map.fitBounds(L.latLng(center).toBounds(radiusMeters * 2), { paddingTopLeft, paddingBottomRight })`. `toBounds(sizeMeters)` takes the total side length, so pass the diameter (radius*2) to contain the circle.

**Why:** The results map is full-screen on mobile with a fixed header overlaying the top and a draggable bottom sheet overlaying the lower ~40vh (collapsed). Symmetric padding still hides the circle behind those overlays, so padding must be asymmetric: clear the header at top and the sheet at bottom. Desktop has no sheet, so symmetric padding is fine.

**How to apply:** When fitting any geo feature that must stay fully visible, reserve padding for every overlay that sits above the map (header height at top; collapsed sheet height — roughly its visible vh — at bottom on mobile). De-dupe view changes with a string key (e.g. `fit:lat,lng` vs `fly:lat,lng,zoom`) so refetches with new array refs but identical coords don't snap the map back, while genuine fit<->fly transitions still re-trigger. Reading viewport size imperatively means resize/orientation won't re-fit — acceptable for fresh-load framing, but add a resize listener if live rotation must re-frame.
