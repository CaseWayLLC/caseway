---
name: solomatch typecheck under workflow contention
description: Why a full tsc typecheck of the solomatch web artifact can hang, and what to use as a validity signal instead.
---

# solomatch typecheck can starve under running workflows

A full `pnpm --filter @workspace/solomatch run typecheck` (`tsc -p tsconfig.json --noEmit`) can hang
indefinitely — sometimes not even emitting the npm header — when the three project workflows
(api-server, mockup-sandbox, solomatch web) are all running. Multiple orphaned tsc runs make it worse,
and aggressive `pkill -9 -f ...` can kill the bash tool's own shell (exit 137).

**Why:** cold tsc compile is CPU/memory heavy; concurrent dev workflows starve it in this container.

**How to apply:**
- Treat a clean **Vite HMR transform** of all changed files (visible in the web workflow logs with no
  transform/parse errors) as a reliable proxy for syntax/JSX validity. esbuild does not typecheck, so
  pair it with a careful manual type review of the diff and/or an architect review.
- If you must run tsc, kill orphan runs by **PID** (`kill -TERM`), not `pkill -9 -f`, then run a single
  instance; expect it to still be slow.
- The contention is environmental, not a code defect — don't rewrite code chasing a hang with empty output.
