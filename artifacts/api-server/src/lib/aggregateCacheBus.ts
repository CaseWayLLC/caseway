import { pool, createListenerClient } from "@workspace/db";
import { logger } from "./logger";
import {
  clearLocalAggregateCaches,
  setAggregateCacheBustPublisher,
} from "./aggregateCaches";

// Cross-instance invalidation for the aggregate count caches via Postgres
// LISTEN/NOTIFY. The in-process TTL caches (statsCache / countiesCache /
// practiceAreaCountiesCache) live per-instance, so a write handled by one
// instance only clears that instance's copy. When the app runs more than one
// instance, peers would keep serving stale counts until the TTL expires.
//
// Postgres is already the single source of truth, so we reuse it as a
// lightweight pub/sub: every bust publishes a NOTIFY on a shared channel, and a
// dedicated listening connection on each instance clears its local caches when
// the notification arrives. No extra infrastructure (Redis) is required. The
// publisher is fire-and-forget — the local clear already happened synchronously,
// so a publish failure only means peers fall back to TTL-bounded staleness, not
// a stale local read.
const CHANNEL = "aggregate_cache_bust";
const RECONNECT_DELAY_MS = 2_000;

type ListenerClient = ReturnType<typeof createListenerClient>;

let listener: ListenerClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let stopped = false;

function scheduleReconnect(): void {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectListener();
  }, RECONNECT_DELAY_MS);
}

async function connectListener(): Promise<void> {
  if (stopped) return;
  const client = createListenerClient();
  // A connection-level error (dropped socket, server restart) ends this client;
  // tear it down and reconnect so the bus self-heals.
  client.on("error", (err) => {
    logger.error({ err }, "Aggregate cache bus listener error; reconnecting");
    if (listener === client) listener = null;
    client.removeAllListeners();
    client.end().catch(() => {});
    scheduleReconnect();
  });
  client.on("notification", (msg) => {
    if (msg.channel === CHANNEL) clearLocalAggregateCaches();
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listener = client;
    logger.info({ channel: CHANNEL }, "Aggregate cache bus listening");
  } catch (err) {
    logger.error(
      { err },
      "Aggregate cache bus failed to connect; will retry",
    );
    client.removeAllListeners();
    client.end().catch(() => {});
    scheduleReconnect();
  }
}

// Publish a bust to all instances (including this one — the local clear already
// ran, and a duplicate clear is harmless). Uses the shared pool for a single
// pg_notify statement; failures are logged, never thrown.
function publishBust(): void {
  pool
    .query("SELECT pg_notify($1, $2)", [CHANNEL, ""])
    .catch((err) =>
      logger.error({ err }, "Aggregate cache bus failed to publish bust"),
    );
}

// Start the cross-instance cache bus: register the publisher used by
// bustAggregateCaches and open the listening connection. Idempotent and
// non-fatal — if Postgres LISTEN/NOTIFY is unavailable the local clear still
// works and staleness on peers stays TTL-bounded. Call once at server boot.
export function initAggregateCacheBus(): void {
  if (started) return;
  started = true;
  stopped = false;
  setAggregateCacheBustPublisher(publishBust);
  void connectListener();
}

// Tear down the listener (for graceful shutdown / tests). Best-effort.
export async function stopAggregateCacheBus(): Promise<void> {
  stopped = true;
  started = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const client = listener;
  listener = null;
  if (client) {
    client.removeAllListeners();
    await client.end().catch(() => {});
  }
}
