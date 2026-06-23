---
name: Artifact-managed workflow removal
description: How to remove an artifact and its auto-generated workflow in this monorepo
---

Artifact-managed workflows (named `artifacts/<slug>: <service>`) CANNOT be deleted with `removeWorkflow` — it returns `PROHIBITED_ACTION` ("managed by an artifact and cannot be deleted via deleteRunWorkflow").

To remove an artifact, just `rm -rf artifacts/<slug>`. The platform detects the deleted `artifact.toml`, deregisters the artifact, and drops its managed workflow automatically (you get an "Removed artifact: <title>" automatic update). Then run a `pnpm install` (e.g. piggy-backed on any `pnpm add`) to resync the lockfile (drops `@workspace/<slug>`), and typecheck.

**Why:** there is no delete callback in the artifacts skill — the directory IS the registration. There is no central registry file to edit; grep finds the slug only in agent metadata/memory, NOT in `.replit` / `pnpm-workspace.yaml`.

**How to apply:** removal = delete dir → pnpm install → typecheck. The removed artifact's `[[ports]]` mapping in `.replit` lingers but is harmless; do not hand-edit `.replit`.
