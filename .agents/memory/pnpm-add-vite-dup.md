---
name: pnpm add can pull a duplicate vite that breaks mockup-sandbox typecheck
description: Adding any dependency refreshes the lockfile and can pull a second vite patch, shifting an artifact's resolution and breaking tsc with cross-version type clashes.
---

Running `pnpm add <dep>` in this workspace — even into a NON-vite package like the
Express `api-server` — refreshes `pnpm-lock.yaml` and can pull a SECOND vite patch
(e.g. `7.3.3` alongside the catalog's `^7.3.5`). If an ARTIFACT (mockup-sandbox or
solomatch) then resolves to the older copy, its `tsc` fails with cross-version
`BuildEnvironment` / `Plugin` / `HotUpdateOptions` "not assignable" errors, while
the other artifact stays green.

**Normal/baseline state has TWO vite copies and is fine:** artifacts resolve to the
catalog version (`^7.3.5`) and `@vitest/mocker` keeps an older one (`7.3.3`). The
break is ONLY when an artifact itself resolves to the older copy.

**Why:** purely a lockfile re-resolution side-effect of the install, NOT a code
change. `pnpm dedupe` alone may not remove the stray copy (it can be a transitive
peer), but it plus a follow-up `pnpm install` re-points the artifacts onto the
catalog version.

**How to apply:** if a typecheck that was green at baseline suddenly fails only in
mockup-sandbox (or solomatch) with vite version-mismatch types right after a
`pnpm add`, run `pnpm dedupe` then `pnpm install`, confirm with
`ls -d node_modules/.pnpm/vite@*` + re-typecheck. Expect the lockfile diff to be
broader than the dep you added (dedupe/pruning). Cf. `types-react-dedup.md` for the
sibling duplicate-`@types/react` clash (fixed via pnpm overrides instead).
