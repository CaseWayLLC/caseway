---
name: Marketing HTML → PDF rendering
description: How the branded one-pager / contract PDFs in marketing/ are produced from their HTML source.
---

The `marketing/*.html` brand documents (commission plan, attorney one-pager, sales-rep
agreement, etc.) are print-styled HTML rendered to PDF with **playwright-core + the system
Chromium** (`page.pdf()`), the same toolchain as `record:walkthrough`. There is no committed
render script — write a throwaway `.mjs` in `scripts/src/` (so `playwright-core` resolves from
that package), run it, then delete it.

**Why a throwaway script, not a permanent one:** these PDFs are regenerated rarely and the repo
keeps only the `.html` source + `.pdf` output; a one-off avoids script clutter.

**How to apply (gotchas that bite):**
- Resolve Chromium via `command -v chromium` (mirror `resolveChromium`/`resolveBin`); don't assume a path.
- `goto(pathToFileURL(html), {waitUntil:"networkidle"})` then `await document.fonts.ready` — Google
  Fonts (Fraunces/Inter) load over the network; skipping the font wait ships fallback fonts.
- Relative asset paths (`assets/logo.png`) resolve from the HTML file's `file://` dir — keep the
  renderer pointed at the file in `marketing/`, don't inline a different cwd.
- For page numbers use `page.pdf({displayHeaderFooter:true, footerTemplate})` with the special
  `.pageNumber`/`.totalPages` spans, and set an explicit `font-size` in the template (Chromium's
  default footer font is ~6px and otherwise looks broken).
- Brand system lives in the HTML `<style>`: Fraunces headings / Inter body, green `hsl(150 41% 22%)`
  + gold `hsl(40 56% 49%)` accents on white; bracketed `[placeholders]` are highlighted gold.
