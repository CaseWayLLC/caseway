---
name: Caseway attorney ranking (Pro-first)
description: Where attorney sort order is decided and the two places that must stay in sync.
---

Attorney result ordering is computed in THREE independent places that must stay consistent:

1. **Server `/attorneys`** — the `GET /attorneys` query `.orderBy(...)` in `artifacts/api-server/src/routes/attorneys.ts`. This is the order used by county pages and by the home search fallback when there are no coordinates (no Maps key).
2. **Server `/attorneys/:id/similar`** — the Similar Lawyers query in the same file orders `desc(isPro), desc(overlap), desc(yearsOfExperience)`. Easy to miss because its primary sort key is practice-area overlap, not id.
3. **Client** — the distance sort in `artifacts/solomatch/src/pages/home.tsx` (`useMemo`), which RE-SORTS by distance whenever `searchCoords` exist, discarding the server order.

**Why:** With a Maps key, the home page fetches the whole approved directory and re-sorts client-side by distance, so a ranking rule added only to the server `orderBy` silently has no effect on the primary search experience. Any ranking change (e.g. the Pro/paid-placement tier: `desc(isPro)` first on the server, `Number(b.isPro)-Number(a.isPro)` first on the client) must be applied in BOTH or the two surfaces disagree.

**How to apply:** When changing how attorneys are ordered, edit the server `orderBy` AND the `home.tsx` distance sort together; verify with a Maps-key (coords) path and a no-coords path.
