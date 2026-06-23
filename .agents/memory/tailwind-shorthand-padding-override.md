---
name: Tailwind padding shorthand overrides directional padding at breakpoints
description: Why `sm:p-6` can silently wipe a base `pt-24`, collapsing spacing in the sm range
---

Do not mix a responsive all-sides padding shorthand (e.g. `sm:p-6`) with an unprefixed directional padding (e.g. `pt-24`) on the same element. At and above the `sm` breakpoint, `sm:p-6` sets padding on ALL sides — including top — overriding the base `pt-24`. The result is correct on mobile and at `md+` (if a `md:pt-32` exists) but collapses top padding in the 640–767px window.

**Why:** Tailwind utilities are plain CSS rules ordered by the generated stylesheet; `sm:p-6` (`padding: 1.5rem`) emitted after/with higher breakpoint specificity beats the unprefixed `pt-24`, so the directional value loses in the sm range. This is invisible at the two viewports usually screenshotted (narrow phone + wide desktop) and only shows on small tablets.

**How to apply:** Keep padding axes consistent. If you need responsive horizontal padding alongside a fixed/stepped vertical padding, use directional utilities throughout (`px-5 sm:px-6 pb-10 pt-24 md:pt-32`) rather than the `p-*` shorthand. When polishing responsive layouts, spot-check the ~700px breakpoint, not just phone + desktop.
