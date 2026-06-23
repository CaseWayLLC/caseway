---
name: Expo workflow port-detection blocker
description: Expo dev workflow reports DIDNT_OPEN_A_PORT even though Metro binds and serves; how to confirm the app actually works.
---

# Expo workflow DIDNT_OPEN_A_PORT vs. Metro actually working

In an isolated task environment, the `expo` workflow restart can fail with
`DIDNT_OPEN_A_PORT` for the artifact's port even though Metro is healthy. Seen
across 7+ restarts up to 440s wait (far beyond any cold start), with the
config matching the canonical Expo template exactly and typecheck passing.

**Why this is misleading:** Metro DOES bind and serve. Verified by running the
exact dev command manually and curling: `http://127.0.0.1:<PORT>/status` and
`http://0.0.0.0:<PORT>/status` both return HTTP 200. The platform's workflow
port-detection harness is what disagrees, and it SIGKILLs the process on
timeout — so you can't keep it alive for a screenshot.

**How to confirm the app is fine without a passing workflow:**
- Run the artifact's `dev` script manually with the same env the workflow sets
  (PORT, BASE_PATH, EXPO_PACKAGER_PROXY_URL=https://$REPLIT_EXPO_DEV_DOMAIN,
  EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN, EXPO_PUBLIC_REPL_ID=$REPL_ID,
  REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN), then curl `/status`.
- A 200 on `/status` (any interface) means Metro binds and serves; the app boots.

**Gotchas during diagnosis:**
- bash-launched processes (even with nohup/disown/setsid) are killed when the
  bash tool command exits (exit 143), so you cannot keep Metro alive across
  turns from the shell to screenshot it.
- `curl`/`ss` from the bash shell cannot see *workflow*-managed ports (separate
  network namespace) — 000/"no response" there is NOT evidence Metro is down.
  Only a process YOU launched in the shell is visible to shell curl.
- The public `https://$REPLIT_EXPO_DEV_DOMAIN/status` returns 502 when the
  backend (Metro) is down, 200 when up — useful to distinguish proxy-up vs
  backend-down.

**Takeaway:** treat this as environmental; the fix belongs to the platform's
detection, not the app. Note it and re-verify the workflow on the main project
after merge rather than burning cycles on more restarts.

## react-native-maps + web preview
`react-native-maps` has NO web implementation. The Replit preview renders the
web bundle, so importing `MapView` directly in a screen breaks web. Split into
`Component.tsx` (native, imports react-native-maps) and `Component.web.tsx`
(web fallback, no maps). Metro auto-resolves per platform.
