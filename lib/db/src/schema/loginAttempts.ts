import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Persistent brute-force guard for the admin PIN login. Replaces the previous
// in-memory counters so the limit survives restarts and is shared across
// stateless server instances. Each row is a counter for one "scope":
//   - per-IP scope, keyed "ip:<address>"
//   - the cross-IP aggregate scope, keyed "global"
// A scope's rolling window starts at firstAt; the limiter resets the counter
// once the window elapses (see api-server lib/loginRateLimit.ts).
export const loginAttemptsTable = pgTable("login_attempts", {
  scope: text("scope").primaryKey(),
  count: integer("count").notNull().default(0),
  firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
