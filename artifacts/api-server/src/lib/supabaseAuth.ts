import {
  createClient,
  type SupabaseClient,
  type User as SupabaseUser,
} from "@supabase/supabase-js";
import type { Request } from "express";
import { config } from "./config";
import { createTtlCache } from "./cache";

// Auth shares the storage Supabase project: the same SUPABASE_URL +
// SUPABASE_SECRET_KEY (service-role key) verify end-user JWTs here and manage
// accounts in the admin routes. The secret key bypasses RLS and must never
// reach the browser.
export function isAuthConfigured(): boolean {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_SECRET_KEY);
}

let client: SupabaseClient | null = null;

// Lazily build the service-role client so the public directory still boots when
// auth is not yet configured.
function getClient(): SupabaseClient | null {
  if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY) return null;
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// The service-role client for admin account management (admin routes). Returns
// null when auth is not configured.
export function getSupabaseAdminClient(): SupabaseClient | null {
  return getClient();
}

export type { SupabaseUser };

// Short-lived positive cache: validating a token is a network round-trip to
// Supabase, so cache the resolved user id briefly to avoid one per request. The
// slot stores the token's own expiry and is never served past it, so the cache
// lifetime is bounded by min(TTL, token exp). Invalid tokens are never cached.
const TOKEN_CACHE_TTL_MS = 30_000;
const tokenCache = createTtlCache<{ userId: string; tokenExpMs: number }>(
  TOKEN_CACHE_TTL_MS,
);

function extractBearerToken(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

// Best-effort decode of a JWT's `exp` (seconds) WITHOUT verifying the signature.
// Used only to bound the positive cache; the token itself is verified by
// supabase.auth.getUser before anything is cached.
function decodeJwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the authenticated attorney's Supabase user id from the request's
 * `Authorization: Bearer <access_token>` header, or null when the caller is not
 * signed in (no / invalid / expired token). This replaces Clerk's
 * getAuth(req).userId; the returned id is the Supabase user UUID stored on
 * attorneys.ownerId.
 */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.tokenExpMs > now) {
    return cached.userId;
  }

  const supabase = getClient();
  if (!supabase) return null;

  let user: SupabaseUser | null = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    user = data.user;
  } catch (err) {
    req.log.error({ err }, "Supabase token verification failed");
    return null;
  }

  // Best-effort: reject a token whose user has since been banned. A ban also
  // blocks sign-in/refresh natively, so this only narrows the window in which an
  // already-issued access token would otherwise still be honored.
  if (user.banned_until && new Date(user.banned_until).getTime() > now) {
    return null;
  }

  // Only cache when the token has a known future expiry, and bound the slot to
  // that expiry so a cached id is never served past the token's own lifetime.
  const tokenExpMs = decodeJwtExpMs(token);
  if (tokenExpMs && tokenExpMs > now) {
    tokenCache.set(token, { userId: user.id, tokenExpMs });
  }

  return user.id;
}

/**
 * Resolve the FULL authenticated Supabase user (including user_metadata) from
 * the request bearer token, or null when not signed in / banned. Unlike
 * getAuthUserId this performs a fresh getUser (no caching), so metadata changes
 * — e.g. a solo -> firm account-type upgrade — are observed immediately.
 */
export async function getAuthUser(req: Request): Promise<SupabaseUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const user = data.user;
    if (
      user.banned_until &&
      new Date(user.banned_until).getTime() > Date.now()
    ) {
      return null;
    }
    return user;
  } catch (err) {
    req.log.error({ err }, "Supabase token verification failed");
    return null;
  }
}

// Attorney account tier, self-selected at signup and stored in user_metadata.
// It gates how many listings the account may hold (solo = one, firm = many).
// Treat ONLY an exact "firm" as a firm; every missing/invalid value is solo.
export type AccountType = "solo" | "firm";
export function getAccountType(user: SupabaseUser): AccountType {
  const raw = (user.user_metadata as { accountType?: unknown } | undefined)
    ?.accountType;
  return raw === "firm" ? "firm" : "solo";
}

// Firm-account review status. Stored in app_metadata (service-role ONLY — a
// client can NEVER write app_metadata via signUp/updateUser), so it is the
// authoritative approval gate. A firm account with no/invalid value is treated
// as "pending": it must be approved by an admin before it can post listings.
// Solo accounts ignore this entirely.
export type FirmStatus = "pending" | "approved" | "rejected";
export function getFirmStatus(user: SupabaseUser): FirmStatus {
  const raw = (user.app_metadata as { firmStatus?: unknown } | undefined)
    ?.firmStatus;
  return raw === "approved" || raw === "rejected" ? raw : "pending";
}

// Firm details collected at signup and stored in user_metadata (the firm's own
// info — display/application data, not used for authorization). Any missing
// field is null.
export type FirmInfo = {
  firmName: string | null;
  firmWebsite: string | null;
  firmAddress: string | null;
  firmPhone: string | null;
};
function readStr(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}
export function getFirmInfo(user: SupabaseUser): FirmInfo {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    firmName: readStr(m.firmName),
    firmWebsite: readStr(m.firmWebsite),
    firmAddress: readStr(m.firmAddress),
    firmPhone: readStr(m.firmPhone),
  };
}
