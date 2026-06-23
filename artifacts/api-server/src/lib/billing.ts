import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { db, attorneysTable } from "@workspace/db";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { bustAggregateCaches } from "./aggregateCaches";

// Paid-posts billing model. A listing is only PUBLIC while it has an
// active/trialing Stripe subscription; demo rows are exempt (gated by the demo
// flag instead). These helpers keep the denormalized billing columns on
// `attorneys` in sync with the externally-managed `stripe.*` synced tables.

export type BillingTier = "founding" | "basic" | "pro";

// Cap on how many attorneys can ever hold the discounted Founding plan.
export const FOUNDING_LIMIT = 10_000;

// Subscription statuses that make a listing publicly visible.
export const ACTIVE_SUB_STATUSES = ["active", "trialing"] as const;

// Plan catalog: the source of truth for the seed script (which creates the
// Stripe products/prices) and a fallback for display. unitAmount is in cents.
export const PLAN_CATALOG: Record<
  BillingTier,
  { name: string; description: string; unitAmount: number }
> = {
  founding: {
    name: "Caseway Founding",
    description:
      "Founding attorney plan — locked-in introductory rate for our first 10,000 listings.",
    unitAmount: 1000,
  },
  basic: {
    name: "Caseway Basic",
    description: "Keep your practice listed and discoverable on Caseway.",
    unitAmount: 10000,
  },
  pro: {
    name: "Caseway Pro",
    description:
      "Premium placement — your listing ranks above standard listings in search.",
    unitAmount: 25000,
  },
};

export function isActiveStatus(status: string | null | undefined): boolean {
  return (
    !!status && (ACTIVE_SUB_STATUSES as readonly string[]).includes(status)
  );
}

function normalizeTier(value: string | null | undefined): BillingTier | null {
  return value === "founding" || value === "basic" || value === "pro"
    ? value
    : null;
}

type SubscriptionRow = {
  id: string;
  status: string | null;
  customer: string | null;
  attorney_id: number | null;
  created: number | null;
  tier: string | null;
};

/**
 * Refreshes the denormalized billing columns on `attorneys` from the synced
 * `stripe.subscriptions` table. Each managed subscription carries
 * metadata.attorneyId (set at checkout); its tier is resolved from the
 * price/product metadata (robust to billing-portal plan changes), falling back
 * to the subscription metadata. Safe to call repeatedly (idempotent).
 */
export async function reconcileBilling(): Promise<{ updated: number }> {
  const result = await db.execute(sql`
    SELECT
      s.id,
      s.status::text AS status,
      s.customer,
      NULLIF(s.metadata->>'attorneyId', '')::int AS attorney_id,
      COALESCE(s.created, 0) AS created,
      COALESCE(
        pr.metadata->>'tier',
        p.metadata->>'tier',
        s.metadata->>'tier'
      ) AS tier
    FROM stripe.subscriptions s
    LEFT JOIN stripe.prices p
      ON p.id = COALESCE(
        s.items->'data'->0->'price'->>'id',
        s.items->0->'price'->>'id'
      )
    LEFT JOIN stripe.products pr ON pr.id = p.product
    WHERE NULLIF(s.metadata->>'attorneyId', '') IS NOT NULL
  `);
  const rows = result.rows as SubscriptionRow[];

  // Group by attorney; pick the most relevant subscription: an active/trialing
  // one wins, otherwise the most recently created (so canceled/past_due is
  // reflected accurately).
  const byAttorney = new Map<number, SubscriptionRow[]>();
  for (const row of rows) {
    if (row.attorney_id == null) continue;
    const list = byAttorney.get(row.attorney_id) ?? [];
    list.push(row);
    byAttorney.set(row.attorney_id, list);
  }

  const managedSubIds: string[] = [];
  let updated = 0;

  for (const [attorneyId, subs] of byAttorney) {
    const sorted = [...subs].sort(
      (a, b) => (b.created ?? 0) - (a.created ?? 0),
    );
    const chosen = sorted.find((s) => isActiveStatus(s.status)) ?? sorted[0];
    if (!chosen) continue;
    managedSubIds.push(chosen.id);

    const active = isActiveStatus(chosen.status);
    const tier = normalizeTier(chosen.tier);

    await db
      .update(attorneysTable)
      .set({
        stripeSubscriptionId: chosen.id,
        stripeCustomerId: chosen.customer ?? null,
        subscriptionStatus: chosen.status ?? null,
        billingTier: tier,
        isPro: active && tier === "pro",
      })
      .where(eq(attorneysTable.id, attorneyId));
    updated++;
  }

  // Safety net: clear billing on any attorney still referencing a managed
  // subscription id that no longer exists in the synced table. Admin-comped
  // listings (no stripe_subscription_id) are left untouched.
  const clearWhere =
    managedSubIds.length > 0
      ? and(
          isNotNull(attorneysTable.stripeSubscriptionId),
          notInArray(attorneysTable.stripeSubscriptionId, managedSubIds),
        )
      : isNotNull(attorneysTable.stripeSubscriptionId);

  await db
    .update(attorneysTable)
    .set({
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      billingTier: null,
      isPro: false,
    })
    .where(clearWhere);

  // Subscription status / isPro changes alter which listings are publicly
  // visible, so invalidate the aggregate count caches.
  bustAggregateCaches();
  return { updated };
}

/** Full backfill from Stripe, then refresh denormalized billing columns. */
export async function syncAndReconcile(): Promise<{ updated: number }> {
  const sync = await getStripeSync();
  await sync.syncBackfill({ object: "all" });
  return reconcileBilling();
}

/** How many attorneys currently hold an active/trialing Founding subscription. */
export async function getFoundingTaken(): Promise<number> {
  const result = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.billingTier, "founding"),
        inArray(attorneysTable.subscriptionStatus, [...ACTIVE_SUB_STATUSES]),
      ),
    );
  return Number(result[0]?.n ?? 0);
}

export async function isFoundingAvailable(): Promise<boolean> {
  return (await getFoundingTaken()) < FOUNDING_LIMIT;
}

/**
 * Cancels a Stripe subscription immediately (going forward; no proration
 * refund — the attorney keeps the period they already paid for). Used when a
 * listing is rejected or removed so we stop billing for something that is no
 * longer publicly visible. Intended for best-effort use: callers should wrap
 * this in try/catch and log, since a Stripe hiccup must not block the
 * moderation/removal action itself.
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
): Promise<void> {
  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.cancel(subscriptionId);
}

/** Resolves the active monthly price id for a tier from the synced tables. */
export async function getPriceIdForTier(
  tier: BillingTier,
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT p.id
    FROM stripe.prices p
    JOIN stripe.products pr ON pr.id = p.product
    WHERE p.active = true AND pr.active = true
      AND (pr.metadata->>'tier' = ${tier} OR p.metadata->>'tier' = ${tier})
      AND p.recurring->>'interval' = 'month'
    ORDER BY p.created DESC NULLS LAST
    LIMIT 1
  `);
  return (result.rows[0] as { id: string } | undefined)?.id ?? null;
}

export type Plan = {
  tier: BillingTier;
  name: string;
  priceId: string;
  unitAmount: number | null;
  currency: string;
  interval: string;
};

/** Lists the three plans from the synced Stripe products/prices (cheapest first). */
export async function listPlans(): Promise<Plan[]> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(pr.metadata->>'tier', p.metadata->>'tier') AS tier,
      pr.name AS name,
      p.id AS price_id,
      p.unit_amount AS unit_amount,
      p.currency AS currency,
      p.recurring->>'interval' AS interval
    FROM stripe.prices p
    JOIN stripe.products pr ON pr.id = p.product
    WHERE p.active = true AND pr.active = true
      AND COALESCE(pr.metadata->>'tier', p.metadata->>'tier') IN ('founding','basic','pro')
      AND p.recurring->>'interval' = 'month'
    ORDER BY p.unit_amount ASC NULLS LAST
  `);
  const rows = result.rows as Array<{
    tier: string | null;
    name: string | null;
    price_id: string;
    unit_amount: number | null;
    currency: string | null;
    interval: string | null;
  }>;

  const seen = new Set<string>();
  const plans: Plan[] = [];
  for (const r of rows) {
    const tier = normalizeTier(r.tier);
    if (!tier || seen.has(tier)) continue;
    seen.add(tier);
    plans.push({
      tier,
      name: r.name ?? PLAN_CATALOG[tier].name,
      priceId: r.price_id,
      unitAmount: r.unit_amount,
      currency: r.currency ?? "usd",
      interval: r.interval ?? "month",
    });
  }
  return plans;
}
