---
name: stripe-replit-sync gotchas
description: Non-obvious failure modes when using stripe-replit-sync in a bundled (esbuild) Express artifact in this monorepo.
---

Three issues cost real time integrating `stripe-replit-sync` (v1.0.0) into an esbuild-bundled api-server. All produce silent/misleading symptoms.

## 1. syncBackfill() with no args syncs NOTHING
`syncBackfill()` defaults to `{ object: this.getSupportedEventTypes }`, which does not match any case in its internal switch, so it is a no-op (logs "complete: 0 items synced" everywhere).
**Fix:** always call `syncBackfill({ object: "all" })` for a full backfill (or a specific `SyncObject` like `"subscription"`).
**How to apply:** any startup init, post-checkout confirm, or manual sync script must pass `object`.

## 2. runMigrations() silently skips when SQL files aren't next to the bundle
The migration `.sql` files live in `node_modules/stripe-replit-sync/dist/migrations`. The lib resolves them via `path.resolve(__dirname, "./migrations")`. esbuild bundles the JS but does NOT copy the `.sql` files, so at runtime the dir is missing and migrations are skipped — BUT it still runs `CREATE SCHEMA IF NOT EXISTS stripe` and logs "Stripe schema ready". Result: the `stripe` schema exists but has zero tables; first real call fails with `relation "stripe.accounts" does not exist`.
**Fix:** in the artifact's `build.mjs`, after esbuild, copy the lib's `migrations` dir into `dist/migrations` (resolve via `createRequire(import.meta.url).resolve("stripe-replit-sync")` → dirname → `migrations`).
**How to apply:** any bundled server that calls `runMigrations` needs the SQL copied beside the output bundle.

## 3. Replit connector credentials use `secret`, not `secret_key`
The Stripe connector proxy (`/api/v2/connection?include_secrets=true&connector_names=stripe`) returns `items[].settings` with keys `account_id, secret, publishable, mcp, claim_url`. The stripe skill's `stripeClient.ts` template reads `settings.secret_key`, which is undefined → "integration not connected" even when it is.
**Fix:** read `settings.secret ?? settings.secret_key`. No `webhook_secret` is present in settings; the managed webhook flow sets it up separately.
**How to apply:** verify actual field names with `listConnections('stripe')` (its `.settings`) rather than trusting the template.

## Dev vs prod webhooks
The managed webhook points at the prod domain (`REPLIT_DOMAINS[0]`), so in dev no webhook fires after checkout. The post-checkout `/checkout/confirm` endpoint compensates by calling `syncBackfill({object:"all"})` itself, then derives "active" from the synced `stripe.subscriptions` rows.
