---
name: Caseway image asset sizes
description: Imported/static images in the web app ship uncompressed; originals were huge and caused slow loads.
---

# Caseway image asset sizes

Vite serves images imported via the `@assets` alias (`attached_assets/`) and files in `artifacts/solomatch/public/` at their original byte size — there is no automatic resize/compression step.

**Incident (fixed):** the landing hero (`attached_assets/golden-justice-scale_*.jpg`, imported as `heroScale` in `home.tsx`) was a ~10.6 MB JPEG shown only as a faded full-bleed background, and the 12 seed headshots (`public/seed-attorneys/N.png`) were ~1.3 MB each but displayed at ≤176px avatars. This made the page "load slow." Fixed by re-encoding in place with ImageMagick (`magick`): hero → 1920px wide JPEG q80 (~100 KB); seed PNGs → 400px (~210 KB each).

**Why:** no build-time image optimizer is wired up; large source files pass straight through to the client.

**How to apply:**
- Keep imported/public images small before relying on them — compress/resize with `magick` (no `sharp`/`cwebp`/`pngquant` installed; ImageMagick is, with WebP delegate).
- Keep the seed headshot **filenames/extension unchanged** (`/seed-attorneys/N.png`): existing demo rows in dev AND prod store those exact paths and `demoData.ts` generates them, so renaming (e.g. to `.webp`) would 404 existing rows. Re-encode in place instead.
