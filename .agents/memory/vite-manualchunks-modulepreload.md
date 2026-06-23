---
name: Vite manualChunks vs modulepreload
description: Why forcing async-only libs into named manualChunks regresses the entry/landing critical path in a Vite React SPA.
---

# Vite manualChunks eagerly modulepreloads named chunks

When you give a library its own named chunk via `build.rollupOptions.output.manualChunks`, Vite adds a `<link rel="modulepreload">` for that chunk to the entry `index.html` if the entry's module graph references it — even when the only real usage is behind `React.lazy`/dynamic import. This pulls heavy, route-only code onto the cold-cache landing critical path (the exact path SEO first-visits hit).

**Rule:** only put libraries in named `manualChunks` that are genuinely needed on the entry/landing path (e.g. `react`/`react-dom`/`scheduler`, `framer-motion` when the landing animates). For libraries used ONLY by lazy routes (leaflet/react-leaflet, recharts, route-specific radix primitives), do NOT name them — let Rollup auto-split them into async chunks so they stay out of the entry's modulepreload set.

**Why:** observed in Caseway (`artifacts/solomatch`) — adding `recharts` to a named manualChunk made the landing `index.html` modulepreload a ~107KB-gz chunk that no landing visitor needs. Removing the manual grouping let Rollup keep it async-only.

**How to verify after any chunking change:** run the production build and inspect `dist/public/index.html` — `grep` the `modulepreload` links. They should list ONLY entry-path vendors + the entry CSS, never leaflet/recharts/route-only chunks. Rollup may name a shared async chunk after an arbitrary member module (e.g. an `alert-dialog-*.js` chunk that is actually recharts); identify by gzip size, and confirm it is absent from the modulepreload set rather than trusting the filename.

**Companion levers on the same critical path:** lazy-load components only rendered after user interaction (e.g. a Leaflet map that appears post-search) and extract auth/marketing pages (sign-in/sign-up + their marketing pitch) into their own lazy route files so they leave the entry bundle entirely.
