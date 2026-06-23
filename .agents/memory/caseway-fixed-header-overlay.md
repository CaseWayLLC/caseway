---
name: Caseway fixed-header over full-screen views
description: Why the global Layout header floats transparently over full-screen (non-window-scrolling) views, and the solidHeader fix.
---

# Fixed header is transparent until the WINDOW scrolls

The global `Layout` header (`solomatch/src/components/layout.tsx`) is `position: fixed` and only gains its opaque/blurred background (`bg-background/80 backdrop-blur-md border + shadow`) once `window.scrollY > 8` (`scrolled` state). Otherwise it is `border-transparent` with no background.

**Why this bites:** Full-screen views that scroll *internally* instead of scrolling the window — e.g. the home **results** step (`step === "results"`, an `h-screen` map + sidebar) — never move `window.scrollY`, so `scrolled` stays `false` forever and the header floats **transparently over the map**. Visible symptom: the map butts right up against the `Caseway` logo/back arrow with no header bar (user-reported "problem here").

**How to apply:** For any view that fills the viewport and scrolls internally, pass `solidHeader` to `Layout` so the header always renders the opaque/blurred bar (home does this with `solidHeader={step === "results"}`). Do NOT rely on the scroll listener for those views.

Note: the results view also has a second back control (a magnifying-glass button + location•category pill in the desktop sidebar) in addition to the header's back arrow — both call `setStep("question")`. Functionally redundant but intentionally kept (the pill shows the active search context).
