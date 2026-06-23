import { getUncachableStripeClient } from "./stripeClient";

/**
 * Idempotently creates the Caseway subscription products + monthly prices in
 * Stripe. Each product is tagged with metadata.tier so the server can resolve
 * the right price at checkout and reconcile subscriptions back to a tier.
 *
 * Run with: pnpm --filter @workspace/scripts run seed:stripe
 *
 * Safe to re-run: products are matched by metadata['tier'] and prices by
 * (amount, monthly interval, currency), so nothing is duplicated.
 */

type TierKey = "founding" | "basic" | "pro";

const PLANS: Array<{
  tier: TierKey;
  name: string;
  description: string;
  unitAmount: number;
}> = [
  {
    tier: "founding",
    name: "Caseway Founding",
    description:
      "Founding attorney plan — locked-in introductory rate for our first 10,000 listings.",
    unitAmount: 1000,
  },
  {
    tier: "basic",
    name: "Caseway Basic",
    description: "Keep your practice listed and discoverable on Caseway.",
    unitAmount: 10000,
  },
  {
    tier: "pro",
    name: "Caseway Pro",
    description:
      "Premium placement — your listing ranks above standard listings in search.",
    unitAmount: 25000,
  },
];

const CURRENCY = "usd";

async function main(): Promise<void> {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    // Find an existing active product by tier (search is eventually consistent,
    // but fine for a manual seed run).
    const search = await stripe.products.search({
      query: `active:'true' AND metadata['tier']:'${plan.tier}'`,
    });
    let product = search.data[0];

    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { tier: plan.tier },
      });
      console.log(`Created product ${product.id} (${plan.tier})`);
    } else {
      console.log(`Found product ${product.id} (${plan.tier})`);
    }

    // Ensure a recurring monthly price at the right amount exists.
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });
    const existing = prices.data.find(
      (p) =>
        p.unit_amount === plan.unitAmount &&
        p.currency === CURRENCY &&
        p.recurring?.interval === "month",
    );

    if (!existing) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.unitAmount,
        currency: CURRENCY,
        recurring: { interval: "month" },
        metadata: { tier: plan.tier },
      });
      console.log(
        `Created price ${price.id} ($${(plan.unitAmount / 100).toFixed(
          2,
        )}/mo, ${plan.tier})`,
      );
    } else {
      console.log(
        `Found price ${existing.id} ($${(
          (existing.unit_amount ?? 0) / 100
        ).toFixed(2)}/mo, ${plan.tier})`,
      );
    }
  }

  console.log("Stripe product seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
