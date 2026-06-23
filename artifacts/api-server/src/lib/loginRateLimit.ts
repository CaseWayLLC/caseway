import { inArray, sql } from "drizzle-orm";
import { db, loginAttemptsTable } from "@workspace/db";

// DB-backed brute-force guard for the admin PIN login. Persisting the counters
// (instead of holding them in process memory) means the limit survives restarts
// and is enforced consistently across multiple stateless server instances.
//
// Two scopes are tracked: a per-IP counter ("ip:<address>") and a cross-IP
// aggregate ("global"). The global cap bounds the total guess rate from a pool
// of rotating IPs that each stay under the per-IP ceiling. The window literal in
// the upsert SQL ('15 minutes') MUST stay in sync with WINDOW_MS below.
const WINDOW_MS = 15 * 60 * 1000;
const PER_IP_MAX = 8;
const GLOBAL_MAX = 30;
const GLOBAL_SCOPE = "global";

function ipScope(ip: string): string {
  return `ip:${ip}`;
}

// True when either the per-IP or the global counter is at/over its limit within
// the current rolling window. Counters older than the window are treated as
// expired (a fresh window starts on the next recorded failure).
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(loginAttemptsTable)
    .where(inArray(loginAttemptsTable.scope, [ipScope(ip), GLOBAL_SCOPE]));

  const now = Date.now();
  for (const row of rows) {
    const fresh = now - row.firstAt.getTime() <= WINDOW_MS;
    if (!fresh) continue;
    const max = row.scope === GLOBAL_SCOPE ? GLOBAL_MAX : PER_IP_MAX;
    if (row.count >= max) return true;
  }
  return false;
}

// Atomically increment one scope's counter, resetting the window if the existing
// counter has already expired. Done in a single upsert so concurrent failures
// don't race on a read-modify-write.
async function bumpScope(scope: string): Promise<void> {
  await db.execute(sql`
    insert into login_attempts (scope, count, first_at)
    values (${scope}, 1, now())
    on conflict (scope) do update set
      count = case
        when login_attempts.first_at < now() - interval '15 minutes' then 1
        else login_attempts.count + 1
      end,
      first_at = case
        when login_attempts.first_at < now() - interval '15 minutes' then now()
        else login_attempts.first_at
      end
  `);
}

export async function recordLoginFailure(ip: string): Promise<void> {
  await Promise.all([bumpScope(ipScope(ip)), bumpScope(GLOBAL_SCOPE)]);
}

// Clear the counters after a successful login (per-IP and the global aggregate).
export async function clearLoginFailures(ip: string): Promise<void> {
  await db
    .delete(loginAttemptsTable)
    .where(inArray(loginAttemptsTable.scope, [ipScope(ip), GLOBAL_SCOPE]));
}
