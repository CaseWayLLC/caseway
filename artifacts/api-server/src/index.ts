import { pool } from "@workspace/db";
import app from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { backfillLocations } from "./lib/location";
import { initStripe } from "./lib/initStripe";
import {
  initAggregateCacheBus,
  stopAggregateCacheBus,
} from "./lib/aggregateCacheBus";

// Last-resort process guards so a stray rejection or throw is logged with full
// context instead of dying silently. An uncaught exception leaves the process in
// an unknown state — log fatally and exit so the workflow restarts cleanly; an
// unhandled rejection is logged but kept non-fatal.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception; exiting");
  process.exit(1);
});

// Graceful shutdown: on a rolling restart/redeploy the platform sends SIGTERM
// (SIGINT on Ctrl-C in dev). First stop accepting new connections and drain
// in-flight requests via server.close(), then tear down the dedicated LISTEN
// connection via stopAggregateCacheBus() and drain the shared pool so we don't
// leak listener connections on Postgres/Supabase. Best-effort and idempotent —
// guard against duplicate signals and force-exit if cleanup hangs.
let shuttingDown = false;
let httpServer: import("http").Server | undefined;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down; closing connections");

  // Don't hang the process if a connection refuses to close.
  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out; forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // Stop accepting new connections and wait for in-flight requests to finish
  // before tearing down shared resources they may still be using (DB pool,
  // LISTEN connection). Bounded by the force-exit timeout above.
  if (httpServer) {
    try {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    } catch (err) {
      logger.error({ err }, "Error closing HTTP server");
    }
  }

  try {
    await stopAggregateCacheBus();
  } catch (err) {
    logger.error({ err }, "Error stopping aggregate cache bus");
  }
  try {
    await pool.end();
  } catch (err) {
    logger.error({ err }, "Error closing database pool");
  }

  clearTimeout(forceExit);
  logger.info("Shutdown complete");
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// config validated DATABASE_URL and the rest at import; PORT is the entry
// point's responsibility (tests import config without listening).
const port = config.PORT;
if (!port) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

httpServer = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // One-time-effective backfill of the structured location columns from each
  // row's officeAddress. onlyMissing makes it a no-op once rows are derived, so
  // it self-heals dev and prod on first boot without a manual admin step.
  backfillLocations({ onlyMissing: true })
    .then((result) => logger.info(result, "Location backfill complete"))
    .catch((err) => logger.error({ err }, "Location backfill failed"));

  // Stripe setup (migrations, managed webhook, backfill, reconcile) runs in the
  // background; failures are logged but never crash the server.
  initStripe().catch((err) => logger.error({ err }, "Stripe init failed"));

  // Cross-instance aggregate-count cache invalidation (Postgres LISTEN/NOTIFY).
  // Non-fatal: if the listening connection can't be established the local clear
  // still works and peer staleness stays TTL-bounded.
  initAggregateCacheBus();
});
