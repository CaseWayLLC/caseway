import { Router, type IRouter, type Request } from "express";
import { getAuthUserId, getAuthUser, getAccountType } from "../lib/supabaseAuth";
import { and, eq, isNull } from "drizzle-orm";
import { db, attorneysTable } from "@workspace/db";
import {
  GetAttorneyParams,
  CreateCheckoutSessionBody,
  GetBillingPlansResponse,
  ConfirmBillingResponse,
} from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  getPriceIdForTier,
  isActiveStatus,
  isFoundingAvailable,
  listPlans,
  syncAndReconcile,
  type BillingTier,
} from "../lib/billing";

const router: IRouter = Router();

// Absolute origin for Stripe redirect URLs. The web app and API share a domain
// behind the Replit proxy, so the request host is the public origin. Prefer the
// browser Origin header (sent on credentialed fetches) when present.
function getPublicOrigin(req: Request): string {
  const origin = req.get("origin");
  if (origin) return origin;
  const proto = req.get("x-forwarded-proto") ?? "https";
  const host = req.get("host") ?? "";
  return `${proto}://${host}`;
}

// Public: the three plans (from synced Stripe products/prices) plus whether the
// discounted Founding plan still has availability.
router.get("/billing/plans", async (_req, res): Promise<void> => {
  const [plans, foundingAvailable] = await Promise.all([
    listPlans(),
    isFoundingAvailable(),
  ]);
  res.json(GetBillingPlansResponse.parse({ plans, foundingAvailable }));
});

// Owner-scoped: start a Stripe Checkout session to subscribe a listing. Under
// the pay-at-submission model this runs right after signup (BEFORE admin
// review), so a pending listing is eligible; the listing only becomes public
// once an admin approves it AND its subscription is active. Auto-prices the
// plan (Founding while slots remain, else Basic) — the client never picks a
// tier here. Pro is a separate dashboard upgrade.
router.post(
  "/attorneys/:id/billing/checkout",
  async (req, res): Promise<void> => {
    const user = await getAuthUser(req);
    if (!user) {
      res
        .status(401)
        .json({ error: "You must be signed in to manage billing" });
      return;
    }
    const userId = user.id;
    // Law firm plans are custom and arranged with our sales team — firms never
    // self-serve the standard Founding/Basic plans through Checkout.
    if (getAccountType(user) === "firm") {
      res.status(409).json({
        error:
          "Law firm plans are custom — please contact our sales team to set up billing.",
        code: "firm_custom_plan",
      });
      return;
    }

    const params = GetAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const flow = parsed.data.flow ?? "dashboard";

    const [listing] = await db
      .select()
      .from(attorneysTable)
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          eq(attorneysTable.ownerId, userId),
          isNull(attorneysTable.archivedAt),
        ),
      );

    if (!listing) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }
    // A rejected listing can never be published, and a listing that already has
    // an active subscription must not start a second one (use the billing
    // portal to manage it, or the Pro upgrade to change tier).
    if (listing.status === "rejected") {
      res.status(409).json({
        error: "This listing wasn't approved and can't be published.",
      });
      return;
    }
    if (isActiveStatus(listing.subscriptionStatus)) {
      res.status(409).json({
        error: "This listing already has an active subscription.",
      });
      return;
    }

    // Auto-select the plan: discounted Founding while slots remain, else Basic.
    const tier: BillingTier = (await isFoundingAvailable())
      ? "founding"
      : "basic";

    const priceId = await getPriceIdForTier(tier);
    if (!priceId) {
      req.log.error({ tier }, "No Stripe price found for tier");
      res.status(503).json({
        error: "Billing is not configured yet. Please try again later.",
      });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Reuse an existing Stripe customer if we have one; otherwise create one and
    // record it so the billing portal works and Checkout doesn't make a dup.
    let customerId = listing.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: listing.email,
        name: listing.fullName,
        metadata: { attorneyId: String(listing.id) },
      });
      customerId = customer.id;
      await db
        .update(attorneysTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(attorneysTable.id, listing.id));
    }

    const origin = getPublicOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Stamp the subscription so reconcileBilling can map it back to a listing.
      subscription_data: {
        metadata: { attorneyId: String(listing.id), tier },
      },
      allow_promotion_codes: true,
      // Signup checkout returns to the confirmation page; dashboard (re)payment
      // returns to the dashboard. A canceled checkout always lands on the
      // dashboard, where the listing shows a "Complete payment" CTA to retry.
      success_url: `${origin}${
        flow === "signup"
          ? "/listing/success?billing=success"
          : "/dashboard?billing=success"
      }`,
      cancel_url: `${origin}/dashboard?billing=cancel`,
    });

    if (!session.url) {
      res.status(502).json({ error: "Could not start checkout" });
      return;
    }
    res.json({ url: session.url });
  },
);

// Owner-scoped: upgrade an already-subscribed listing to the Pro tier. We
// modify the EXISTING subscription's price (prorated) instead of starting a
// new Checkout, which would create a SECOND subscription for the same listing.
router.post(
  "/attorneys/:id/billing/upgrade-pro",
  async (req, res): Promise<void> => {
    const user = await getAuthUser(req);
    if (!user) {
      res
        .status(401)
        .json({ error: "You must be signed in to manage billing" });
      return;
    }
    const userId = user.id;
    // Pro is a standard self-serve tier; law firms are on custom, sales-managed
    // plans, so they don't self-upgrade to Pro here.
    if (getAccountType(user) === "firm") {
      res.status(409).json({
        error: "Law firm plans are custom — please contact our sales team.",
        code: "firm_custom_plan",
      });
      return;
    }

    const params = GetAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [listing] = await db
      .select()
      .from(attorneysTable)
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          eq(attorneysTable.ownerId, userId),
          isNull(attorneysTable.archivedAt),
        ),
      );

    if (!listing) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }
    // A rejected listing can't be upgraded — its subscription is canceled on
    // reject (best-effort), and it can never go public.
    if (listing.status === "rejected") {
      res.status(409).json({
        error: "This listing wasn't approved and can't be upgraded.",
      });
      return;
    }
    if (
      !listing.stripeSubscriptionId ||
      !isActiveStatus(listing.subscriptionStatus)
    ) {
      res
        .status(409)
        .json({ error: "Subscribe to a plan first, then upgrade to Pro." });
      return;
    }
    if (listing.billingTier === "pro") {
      res
        .status(409)
        .json({ error: "This listing is already on the Pro plan." });
      return;
    }

    const proPriceId = await getPriceIdForTier("pro");
    if (!proPriceId) {
      req.log.error("No Stripe price found for Pro tier");
      res.status(503).json({
        error:
          "The Pro plan isn't available right now. Please try again later.",
      });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const subscription = await stripe.subscriptions.retrieve(
      listing.stripeSubscriptionId,
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      req.log.error(
        { subscriptionId: listing.stripeSubscriptionId },
        "Subscription has no line item to upgrade",
      );
      res.status(502).json({ error: "Could not upgrade your subscription." });
      return;
    }

    // Swap the line item to the Pro price; reconcileBilling resolves tier from
    // the price/product metadata first, so this is what flips billingTier/isPro
    // (the metadata tier is a fallback).
    await stripe.subscriptions.update(listing.stripeSubscriptionId, {
      items: [{ id: itemId, price: proPriceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...subscription.metadata,
        attorneyId: String(listing.id),
        tier: "pro",
      },
    });

    // The synced stripe.* tables are stale until the next webhook (which only
    // fires against prod), so resync + reconcile to reflect Pro immediately.
    const result = await syncAndReconcile();
    res.json(
      ConfirmBillingResponse.parse({ ok: true, updated: result.updated }),
    );
  },
);

// Owner-scoped: open the Stripe billing portal to manage/cancel a subscription.
router.post(
  "/attorneys/:id/billing/portal",
  async (req, res): Promise<void> => {
    const userId = await getAuthUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ error: "You must be signed in to manage billing" });
      return;
    }

    const params = GetAttorneyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [listing] = await db
      .select()
      .from(attorneysTable)
      .where(
        and(
          eq(attorneysTable.id, params.data.id),
          eq(attorneysTable.ownerId, userId),
          isNull(attorneysTable.archivedAt),
        ),
      );

    if (!listing) {
      res.status(404).json({ error: "Attorney not found" });
      return;
    }
    if (!listing.stripeCustomerId) {
      res
        .status(409)
        .json({ error: "No billing account yet. Choose a plan first." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const origin = getPublicOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: listing.stripeCustomerId,
      return_url: `${origin}/dashboard`,
    });
    res.json({ url: session.url });
  },
);

// Signed-in: force a sync + reconcile. Used after returning from Checkout in
// dev (where the managed webhook targets prod and never fires locally).
router.post("/billing/confirm", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in" });
    return;
  }
  try {
    const result = await syncAndReconcile();
    res.json(
      ConfirmBillingResponse.parse({ ok: true, updated: result.updated }),
    );
  } catch (err) {
    req.log.error({ err }, "Billing confirm sync failed");
    res.status(502).json({ error: "Could not refresh billing status" });
  }
});

export default router;
