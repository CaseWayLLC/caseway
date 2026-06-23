// Minimal in-process TTL cache for hot, read-heavy aggregate endpoints (e.g.
// directory stats and county indexes). These reads are expensive (full-table
// unnest aggregations) but tolerate brief staleness. Keying by the inputs that
// change the result (the demo/paid-posts flags) means an admin flag flip lands
// on a different cache slot and is reflected immediately rather than waiting out
// the TTL. Safe under multiple stateless instances: each keeps its own copy and
// staleness is bounded by the TTL.
export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
}

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const store = new Map<string, { value: T; expires: number }>();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, expires: Date.now() + ttlMs });
    },
    clear() {
      store.clear();
    },
  };
}
