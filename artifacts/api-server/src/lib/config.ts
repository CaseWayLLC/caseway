import { z } from "zod/v4";
import { logger } from "./logger";

// Single source of truth for server configuration. Reads and validates the
// environment ONCE at import time. A Postgres connection string is required
// (SUPABASE_DB_URL preferred, DATABASE_URL fallback) and fails fast with a
// clear message; everything else is optional here and the features that depend
// on it warn (loudly in production) but never take the site down.
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // The entry point (index.ts) owns the hard PORT check so importing config in
  // tests (which never listen) doesn't require it.
  PORT: z.coerce.number().int().positive().optional(),
  // Supabase is the source of truth for data. SUPABASE_DB_URL points the app at
  // Supabase Postgres; it takes precedence over Replit's reserved,
  // auto-populated DATABASE_URL (which stays as a fallback).
  SUPABASE_DB_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(1).optional(),
  ADMIN_PIN: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("attorney-photos"),
  REPLIT_DOMAINS: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
});

// A Postgres connection string is required, satisfied by EITHER variable.
const EnvSchemaChecked = EnvSchema.refine(
  (env) => Boolean(env.SUPABASE_DB_URL || env.DATABASE_URL),
  {
    error:
      "Set SUPABASE_DB_URL (preferred) or DATABASE_URL — a Postgres connection string is required",
    path: ["SUPABASE_DB_URL"],
  },
);

export type AppConfig = z.infer<typeof EnvSchema>;

function load(): AppConfig {
  const parsed = EnvSchemaChecked.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server configuration. Fix these environment variable(s):\n${issues}`,
    );
  }
  return parsed.data;
}

export const config: AppConfig = load();

// The effective Postgres connection string. Supabase (SUPABASE_DB_URL) is the
// source of truth; DATABASE_URL (Replit's reserved, auto-populated var) is the
// fallback. load() guarantees at least one is present.
export const databaseUrl: string = (config.SUPABASE_DB_URL ??
  config.DATABASE_URL)!;

export const isProduction = config.NODE_ENV === "production";

// Storage is configured only when both Supabase values are present.
export const isStorageConfigured = Boolean(
  config.SUPABASE_URL && config.SUPABASE_SECRET_KEY,
);

// Soft-required: the public directory still boots without these, but dependent
// features are disabled. Warn loudly in production so a misconfigured deploy is
// obvious in the logs.
function warnSoftConfig(): void {
  const soft: Array<[keyof AppConfig, string]> = [
    ["SESSION_SECRET", "admin session signing"],
    ["ADMIN_PIN", "admin sign-in"],
    ["SUPABASE_URL", "photo storage / attorney authentication"],
    ["SUPABASE_SECRET_KEY", "photo storage / attorney authentication"],
  ];
  const missing = soft.filter(([k]) => !config[k]).map(([k]) => k);
  if (missing.length > 0) {
    logger.warn(
      { missing },
      isProduction
        ? "Missing configuration; dependent features are disabled"
        : "Missing optional configuration (ok in development)",
    );
  }

  // A short or all-numeric PIN stays brute-forceable despite the login rate
  // limiting; recommend a longer alphanumeric value.
  const pin = config.ADMIN_PIN;
  if (pin && (pin.length < 8 || /^\d+$/.test(pin))) {
    logger.warn(
      "ADMIN_PIN is weak (short or all digits). Use a longer alphanumeric admin code for stronger brute-force resistance.",
    );
  }
}

warnSoftConfig();
