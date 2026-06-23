---
name: Single @types/react across workspace
description: Why pnpm-workspace.yaml force-pins one @types/react/@types/react-dom version
---

The web stack (catalog `@types/react: ^19.2.0`) and the Expo mobile app (pins `~19.1.x`, required by its SDK) pull two different `@types/react` copies into the pnpm store. When both exist, web UI deps like `lucide-react` (hoisted, keyed only by `react`, not by `@types/react`) resolve their `react` types against the *other* copy than the web app, producing `TS2322`/`TS2742` "Two different types with this name exist, but they are unrelated" — classically surfaced in `ui/spinner.tsx` (a lucide forwardRef icon).

**Fix:** `overrides` in `pnpm-workspace.yaml` force a single version: `"@types/react": "19.2.14"` + `"@types/react-dom": "19.2.3"`. Verified BOTH `@workspace/solomatch` and `@workspace/caseway-mobile` typecheck clean against the pinned web version.

**Why:** the post-merge script only runs `pnpm install` + `db push`, so it never typechecks; a duplicate-types regression from merging a new artifact (the Expo app) lands silently on main and only shows up when you run `pnpm run typecheck`.

**How to apply:** after merging any artifact that pins its own `@types/react` (Expo/React Native especially), run the full `pnpm run typecheck`. If you see "unrelated" React type errors, keep/restore this override rather than casting individual components. The runtime `react`/`react-dom` stay `19.1.0` (catalog) for Expo — only the *types* are unified.
