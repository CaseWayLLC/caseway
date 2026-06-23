---
name: Caseway homepage motion model
description: How the home.tsx step transitions stay smooth — one translate source, no compounding
---

# Caseway homepage step motion

The home flow swaps one `motion.div` per step inside `AnimatePresence mode="wait"`. Rule:

**One source of translation per transition.** The step container owns the slide; the results step is a pure opacity cross-fade (never translate a full Leaflet map). Anything INSIDE a step animates **opacity only** on mount (no second y/scale).

**Why:** When inner elements also translate on mount, they move on top of the parent step slide — two overlapping transforms on different curves read as a visible "glitch." It is worse for elements carrying a backdrop-filter or large shadow: translating them re-samples the backdrop / re-rasterizes the shadow every frame and drops frames. Animating `filter: blur()` is the worst offender — don't.

**How to apply:**
- New reveal inside a step → use opacity (optional stagger delay), not y/scale. A per-child stagger that out-runs the parent step slide (e.g. card delays totalling >0.4s on a 0.4s container) reads as a two-wave "funny load" — prefer letting children ride the parent's single slide+fade (plain divs) over an independent stagger once the container slide got slower.
- Keep the hero card's blur/shadow modest, since the step still translates it once per landing transition; don't escalate them back.
- Timing is ASYMMETRIC and lives INSIDE the variant objects (not the component `transition` prop, which is removed): exit is a quick ease-in accelerate (~0.2s, `[0.4,0,1,1]`) so the leaving step whips away; center/enter is a slower ease-out settle (~0.4–0.45s, `[0.22,1,0.36,1]`). Under `mode="wait"` a symmetric same-speed fade-out→fade-in reads as a "weird load"/reload — the fast-exit + smooth-enter split is what fixes it. Keep ease arrays inline in the variants (extracting to a const breaks the strict-TS Easing tuple type).

**AnimatePresence exit gotcha (attorney-profile-panel.tsx and any open/close overlay):** a component that does `if (!open) return null;` BEFORE its own `AnimatePresence` can NEVER play an exit animation — returning null unmounts the whole tree so AnimatePresence never sees a child leave (open slides in, close snaps shut). Fix: always render `AnimatePresence` and toggle a *keyed* child inside it (`{open && (<div key="...">…)}`); the motion descendants' `exit` props then run on close. The panel slide uses the same tween ease-out (`[0.22,1,0.36,1]`, ~0.42s), not an underdamped spring, and the loaded-content branch fades in (opacity) so the skeleton→content swap doesn't pop.
