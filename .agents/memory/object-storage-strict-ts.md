---
name: object-storage server template gotchas
description: Non-obvious fixes needed when copying the object-storage server template into this Express api-server.
---

# Object storage server template gotchas

## 1. Strict-TS cast on the signed-URL helper
After copying `objectStorage.ts` from the object-storage skill template, `tsc`
fails with TS2339 on the sidecar `signObjectURL` helper:
`const { signed_url } = await response.json()` — `response.json()` resolves to
`unknown` under this repo's strict config.
**Fix:** `(await response.json()) as { signed_url: string }`. Type-only change;
do not alter the GCS/sidecar logic.

## 2. Upload endpoint ships UNAUTHENTICATED
The template's `POST /storage/uploads/request-url` mints presigned upload URLs
with no auth — anonymous callers can write to the bucket / rack up cost.
**Fix:** gate it before mounting the storage router. This app verifies a Supabase
Auth bearer via `await getAuthUserId(req)` (see `lib/supabaseAuth.ts`), so a guard
that 401s when it returns null, registered *before* `router.use(storageRouter)`,
works (Express runs it first, then the handler).
Public `GET /storage/objects/*` is left open on purpose — attorney headshots are
public profile photos.

## 3. Object paths vs. http(s) URL validation
When an uploaded photo is stored as an object path (`/objects/uploads/<uuid>`)
in a field that the server otherwise validates as a safe http(s) URL, the
http(s)-only check rejects it (400).
**Fix:** exempt values starting with `/objects/` for that field before the
`isSafeHttpUrl` check.
**Why:** the upload flow stores a path, not a URL; the frontend resolver
prefixes `/api/storage` at render time.
