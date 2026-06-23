---
name: Grid/flex child fixed-width overflow
description: Why a responsive grid/flex column overflows the viewport on mobile when it contains a fixed-width child, and the idiomatic fix.
---

A responsive CSS grid (or flex) collapsing to one column on mobile can still overflow the viewport horizontally if a child has an intrinsic/fixed width (e.g. a third-party widget styled `w-[440px]`).

**Why:** grid/flex items default to `min-width: auto`, so the track refuses to shrink below the child's intrinsic width — the fixed-width child forces the column (and page) wider than a narrow viewport, producing horizontal scroll.

**How to apply:**
- Add `min-w-0` (and usually `w-full`) to the grid/flex *children* so the track may shrink and the child can fill the available width.
- For the fixed-width child itself, prefer `w-full max-w-[440px]` over `w-[440px] max-w-full` — it states the intent directly (fill container on small screens, cap on large).
- In this repo this bit the auth card on `/sign-in` and `/sign-up` (two-column pitch + auth-card grid) in `artifacts/solomatch/src/App.tsx`. Sibling gotcha: `tailwind-shorthand-padding-override.md`.
