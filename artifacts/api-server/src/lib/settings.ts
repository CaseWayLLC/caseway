import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";

const DEMO_MODE_KEY = "demo_mode_enabled";
const PAID_POSTS_KEY = "paid_posts_enabled";

async function getFlag(key: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));
  return row?.value === "true";
}

async function setFlag(key: string, enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  await db
    .insert(appSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

export function getDemoMode(): Promise<boolean> {
  return getFlag(DEMO_MODE_KEY);
}

export function setDemoMode(enabled: boolean): Promise<void> {
  return setFlag(DEMO_MODE_KEY, enabled);
}

// Paid-posts enforcement switch. When false (the default), every approved,
// non-archived listing is publicly visible regardless of billing (pre-launch /
// testing). When true, a non-demo listing is public only while it carries an
// active/trialing Stripe subscription. Flip this on once Stripe is connected
// and you are ready to go live with the paid-only directory.
export function getPaidPostsEnabled(): Promise<boolean> {
  return getFlag(PAID_POSTS_KEY);
}

export function setPaidPostsEnabled(enabled: boolean): Promise<void> {
  return setFlag(PAID_POSTS_KEY, enabled);
}
