---
name: video-js build gotchas (this repo)
description: Non-obvious blockers when building video-js artifacts here — audio service auth, and a scaffold tsconfig that omits the DOM lib.
---

# video-js build gotchas (this repo)

## Audio generation can be unavailable (401)
The video audio callbacks (`generateMusic`, `textToSpeech`, `generateSoundEffect`) may fail with
`Audio generation failed (401): invalid_api_key`. When that happens you cannot add the default
background-music bed, so the video ships silent. Do NOT retry the same call repeatedly — it is an
external-service credential issue, not a transient. Still wire the scene-selector controls; just skip
the audio element + mute button (there is no file to play). Tell the user music was skipped and can be
added later once the audio service key works.

**Why:** observed June 2026 while building `artifacts/caseway-ad`. The flag/key may get fixed later, so
re-test once before assuming it is still broken.

## Newly scaffolded video-js tsconfig omits the DOM lib
A fresh `createArtifact({ artifactType: "video-js" })` writes `artifacts/<slug>/tsconfig.json` WITHOUT a
`lib` entry, so it inherits `tsconfig.base.json`'s `lib: ["es2022"]` — no DOM. `pnpm run typecheck` then
fails on EVEN THE UNTOUCHED SCAFFOLD (`hooks.ts`, `main.tsx`): "Cannot find name 'window' / 'document' /
'Node'", `PointerEvent.pointerType` missing, and cascading framer-motion Variant errors.

**Fix:** add `"lib": ["esnext", "dom", "dom.iterable"]` to the artifact's `tsconfig.json` (matches the
working web artifact `artifacts/solomatch/tsconfig.json`). After that, typecheck is clean.

**How to apply:** the video still RUNS without this fix (Vite/esbuild does not typecheck), so the bug is
invisible until you run `tsc`. If you intend to run `pnpm run typecheck` (or it is a registered
validation step), patch the new video artifact's tsconfig first.
