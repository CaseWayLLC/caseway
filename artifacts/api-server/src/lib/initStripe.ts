import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { reconcileBilling } from "./billing";
import { config, databaseUrl } from "./config";
import { logger } from "./logger";

/**
 * Boot-time Stripe setup for the paid-posts model. Runs in the background after
 * the server starts; failures are logged, never fatal — the public directory
 * reads denormalized billing columns and does not need Stripe to be live.
 *
 * Order: runMigrations (create `stripe` schema + synced tables) → getStripeSync
 * → findOrCreateManagedWebhook (prod domain) → syncBackfill({object:"all"}) →
 * reconcileBilling (refresh denormalized columns).
 */
export async function initStripe(): Promise<void> {
  // Bundled SQL migrations are copied to dist/migrations by build.mjs;
  // runMigrations resolves them relative to the output bundle.
  await runMigrations({ databaseUrl });

  try {
    const sync = await getStripeSync();

    // The managed webhook targets the public production domain. In dev no
    // webhook fires (it points at prod), so /billing/confirm compensates by
    // syncing on demand after checkout.
    const domain = (config.REPLIT_DOMAINS ?? "").split(",")[0]?.trim();
    if (domain) {
      await sync.findOrCreateManagedWebhook(
        `https://${domain}/api/stripe/webhook`,
      );
    } else {
      logger.warn("No REPLIT_DOMAINS set; skipping managed webhook creation");
    }

    await sync.syncBackfill({ object: "all" });
    const result = await reconcileBilling();
    logger.info(result, "Stripe billing reconciled");
  } catch (err) {
    logger.error(
      { err },
      "Stripe init (sync/webhook) failed; continuing without live billing",
    );
  }
}
