---
name: Playwright live-site walkthrough recording
description: Record a real screen-capture demo video of a running artifact (no bundled browser)
---

To record a real screen-capture product demo of a live artifact in this Nix env, drive the running app with Playwright and convert to mp4 with ffmpeg. Persisted as `pnpm --filter @workspace/scripts run record:walkthrough` (`scripts/src/record-walkthrough.mjs`); output `media/caseway-walkthrough.mp4`.

Choices that make it work here:
- Use `playwright-core` (NOT `playwright`) as the dep — `playwright-core` has no postinstall browser download. Point `executablePath` at the system Chromium (`command -v chromium`, a Nix store path); override via `WT_CHROMIUM`.
- Resolve ffmpeg the same way (`command -v ffmpeg`, override `WT_FFMPEG`). Playwright records webm only, so transcode webm→mp4 with libx264 `-pix_fmt yuv420p -movflags +faststart -an` for broad compatibility.
- Drive the REAL app via the shared proxy at `http://localhost:80/` (override `WT_URL`); the web + api workflows must be running.
- Write the recorder as `.mjs`, not `.ts`: the scripts tsconfig has no DOM lib and `allowJs` off, so `.mjs` is skipped by `tsc --noEmit` and the `page.evaluate` DOM callbacks don't trip typecheck.
- Inject the guided-cursor + caption overlay on `<body>` so it survives SPA route changes within one continuous recording.

**Why:** the bundled-browser download is blocked/slow, and a `.ts` recorder would fail typecheck (no DOM lib); this combo is the reliable path.

## Smoothness: fix it at the SOURCE, not the encoder
The Playwright `recordVideo` capture is a hard-locked steady 25fps (probe: `r_frame_rate=25/1`, ~720 frames over ~28.8s) — there is no fps knob. So perceived choppiness must be solved in the recording, not the transcode:
- Make cursor glides LONG enough to span many frames at 25fps. A 360ms eased move = only ~9 frames (choppy); ~600ms = ~16 frames (reads smooth). Trim dead-air *holds* instead to keep overall pace quick.
- `minterpolate=mi_mode=blend` only cross-fades (ghosting), it does not add real motion — keep it as the cheap default but don't expect it to fix choppy fast moves.
- `minterpolate=mi_mode=mci` (motion-compensated, true in-between frames) is the only real smoother but is NOT feasible in this env: every variant (full aobmc+vsbmc, light obmc, even coarse mb_size=32/fps48/search_param=8) either timed out at the 120s bash limit or got OOM-killed (137/143). Left it as an opt-in `WT_SMOOTH_MODE=mci` for beefier machines; default is `blend`.

**Why:** spent a long loop trying to encode smoothness in; the win came entirely from longer eased source glides.

## Memory pressure & detached jobs
- Backgrounding the encode to dodge the 120s bash limit does NOT work: `setsid`/`nohup ... &` jobs get SIGTERM'd (143) when the bash call returns.
- The 4 dev workflows (api + Expo Metro + 2 Vite) already sit at ~7GB/8GB used, leaving <1GB free. Spawning Chromium for a recording then OOM-kills (143) or the whole bash command is SIGKILL'd (137) — even tiny commands like `pkill`.
- A recording that gets SIGTERM'd mid-run leaves ORPHANED chromium processes (they never hit `browser.close()`), which pile up and worsen pressure. Reap them before retrying: `pkill -9 -f chrome` (it lands even if the shell itself is then OOM-killed; verify with `ps -eo comm | grep -ci chrom`).
- `WT_KEEP_SOURCE=1` keeps the 25fps webm + a `lead.txt` (the ffmpeg `-ss` lead-trim seconds) so you can re-encode cheaply (no Chromium) if only the encode step is interrupted.
