import type {
  GetDirectoryStatsResponse,
  ListCountiesResponse,
  ListPracticeAreaCountiesResponse,
} from "@workspace/api-zod";
import { createTtlCache } from "./cache";

// Shared in-process TTL caches for the read-heavy aggregate endpoints
// (/stats, /counties, /practice-area-counties). They live here — rather than
// inside the attorneys route module — so every listing write path (owner
// create/edit/pause/delete in routes/attorneys.ts, admin
// approve/reject/restore/permanent-delete/pro/verify in routes/admin.ts, and
// reconcileBilling in lib/billing.ts) can bust them the instant the underlying
// data changes, instead of serving stale counts for up to the TTL.
export const AGGREGATE_CACHE_TTL_MS = 60_000;

export const statsCache = createTtlCache<
  ReturnType<typeof GetDirectoryStatsResponse.parse>
>(AGGREGATE_CACHE_TTL_MS);
export const countiesCache = createTtlCache<
  ReturnType<typeof ListCountiesResponse.parse>
>(AGGREGATE_CACHE_TTL_MS);
export const practiceAreaCountiesCache = createTtlCache<
  ReturnType<typeof ListPracticeAreaCountiesResponse.parse>
>(AGGREGATE_CACHE_TTL_MS);

// Clear ONLY this instance's in-process caches. Used both by the local bust
// path and by the cross-instance bus when a peer signals a bust.
export function clearLocalAggregateCaches(): void {
  statsCache.clear();
  countiesCache.clear();
  practiceAreaCountiesCache.clear();
}

// Cross-instance publisher hook. Installed by the aggregate cache bus
// (initAggregateCacheBus) so a bust on one instance propagates to every other
// running instance. Defaults to a no-op so single-instance behavior — and any
// code path that never starts the bus (e.g. unit tests importing routes
// directly) — keeps working with a purely local clear.
let publishBust: () => void = () => {};

export function setAggregateCacheBustPublisher(fn: () => void): void {
  publishBust = fn;
}

// Bust every aggregate cache. Call after any write that can change which
// listings are publicly visible (or their county/practice-area/free-consult
// attributes) so the next read recomputes fresh counts immediately. Clears this
// instance locally first (instant, never fails) then fans the signal out to the
// other instances via the bus so their copies are dropped too.
export function bustAggregateCaches(): void {
  clearLocalAggregateCaches();
  publishBust();
}
