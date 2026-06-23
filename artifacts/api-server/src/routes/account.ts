import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, attorneysTable } from "@workspace/db";
import {
  DeleteOwnAccountResponse,
  GetAccountBillingOverviewResponse,
} from "@workspace/api-zod";
import { getAuthUserId, getSupabaseAdminClient } from "../lib/supabaseAuth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { cancelStripeSubscription, isActiveStatus } from "../lib/billing";
import { bustAggregateCaches } from "../lib/aggregateCaches";

const router: IRouter = Router();

// Show at most this many recent invoices per listing's Stripe customer. Receipts
// older than that are still reachable from the Stripe-hosted invoice page.
const INVOICE_LIMIT = 6;

// Owner-scoped: a single account-level billing view aggregated across ALL the
// signed-in user's listings. Each listing carries its OWN Stripe customer +
// subscription, so we fan out per listing. We never return Stripe customer ids
// to the browser — only the derived subscription summary and receipt links.
router.get("/account/billing", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in" });
    return;
  }

  // Exclude archived (admin-deleted / removed) listings — a deleted listing has
  // its subscription canceled and should not surface in the billing overview.
  const listings = await db
    .select()
    .from(attorneysTable)
    .where(
      and(
        eq(attorneysTable.ownerId, userId),
        isNull(attorneysTable.archivedAt),
      ),
    );

  // One Stripe client for the whole request (credentials are fetched per call,
  // so build it lazily and reuse it across listings).
  let stripeClient: Stripe | null = null;
  async function stripe(): Promise<Stripe> {
    if (!stripeClient) stripeClient = await getUncachableStripeClient();
    return stripeClient;
  }

  const result = await Promise.all(
    listings.map(async (listing) => {
      const summary = {
        attorneyId: listing.id,
        fullName: listing.fullName,
        firmName: listing.firmName,
        status: listing.status,
        archived: listing.archivedAt != null,
        billingTier: listing.billingTier,
        subscriptionStatus: listing.subscriptionStatus,
        subscription: null as {
          status: string | null;
          tier: string | null;
          amount: number | null;
          currency: string | null;
          interval: string | null;
          currentPeriodEnd: number | null;
          cancelAtPeriodEnd: boolean | null;
        } | null,
        invoices: [] as Array<{
          id: string;
          number: string | null;
          created: number;
          amountPaid: number;
          amountDue: number;
          currency: string;
          status: string | null;
          hostedInvoiceUrl: string | null;
          invoicePdf: string | null;
        }>,
      };

      // Live subscription detail. The price object is embedded on the item by
      // default; the per-period dates live on the item (not the subscription)
      // in current Stripe API versions.
      if (listing.stripeSubscriptionId) {
        try {
          const sub = await (
            await stripe()
          ).subscriptions.retrieve(listing.stripeSubscriptionId);
          const item = sub.items.data[0];
          const price = item?.price;
          summary.subscription = {
            status: sub.status ?? null,
            tier: listing.billingTier ?? null,
            amount: price?.unit_amount ?? null,
            currency: price?.currency ?? sub.currency ?? null,
            interval: price?.recurring?.interval ?? null,
            currentPeriodEnd: item?.current_period_end ?? null,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? null,
          };
        } catch (err) {
          req.log.warn(
            { err, attorneyId: listing.id },
            "Could not load subscription detail for billing overview",
          );
        }
      }

      // Recent invoices / receipts for this listing's customer.
      if (listing.stripeCustomerId) {
        try {
          const invoices = await (
            await stripe()
          ).invoices.list({
            customer: listing.stripeCustomerId,
            limit: INVOICE_LIMIT,
          });
          summary.invoices = invoices.data
            .filter((inv): inv is Stripe.Invoice & { id: string } =>
              Boolean(inv.id),
            )
            .map((inv) => ({
              id: inv.id,
              number: inv.number ?? null,
              created: inv.created,
              amountPaid: inv.amount_paid,
              amountDue: inv.amount_due,
              currency: inv.currency,
              status: inv.status ?? null,
              hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
              invoicePdf: inv.invoice_pdf ?? null,
            }));
        } catch (err) {
          req.log.warn(
            { err, attorneyId: listing.id },
            "Could not load invoices for billing overview",
          );
        }
      }

      return summary;
    }),
  );

  res.json(GetAccountBillingOverviewResponse.parse({ listings: result }));
});

// Owner-scoped: self-serve permanent account deletion. Unlike the admin delete
// (which keeps the listings live and only nulls ownerId), a self-delete means
// the attorney is leaving, so their public listings are taken DOWN (archived)
// and any active billing is stopped. Ordering is deliberate so we never end up
// with a deleted account that is still being billed or still publicly listed:
//   1) cancel active subscriptions FIRST (abort with 502 if any cancel fails),
//   2) archive listings + clear Pro + mark canceled (bust aggregate caches),
//   3) delete the Supabase auth user,
//   4) best-effort null the now-dangling ownerId.
router.delete("/account", async (req, res): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: "You must be signed in" });
    return;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    res.status(503).json({ error: "Authentication is not configured." });
    return;
  }

  // All owned listings, including already-archived ones, so deletion is
  // idempotent if a previous attempt got partway through.
  const listings = await db
    .select()
    .from(attorneysTable)
    .where(eq(attorneysTable.ownerId, userId));

  // 1) Cancel active/trialing subscriptions before touching the account. If any
  //    cancel fails we stop here so the user is never deleted while still billed.
  const activeSubs = listings.filter(
    (l): l is typeof l & { stripeSubscriptionId: string } =>
      Boolean(l.stripeSubscriptionId) && isActiveStatus(l.subscriptionStatus),
  );
  let canceledSubscriptions = 0;
  for (const listing of activeSubs) {
    try {
      await cancelStripeSubscription(listing.stripeSubscriptionId);
      canceledSubscriptions += 1;
    } catch (err) {
      req.log.error(
        { err, attorneyId: listing.id },
        "Failed to cancel subscription during account deletion",
      );
      res.status(502).json({
        error:
          "We couldn't cancel one of your active subscriptions, so your account was not deleted. Please try again.",
      });
      return;
    }
  }

  // 2) Take the listings down. Preserve an existing archive timestamp via
  //    COALESCE so re-running deletion doesn't reset it; clear Pro and mark the
  //    subscription canceled. Count only the listings that were live until now.
  const archivedListings = listings.filter((l) => l.archivedAt == null).length;
  if (listings.length > 0) {
    await db
      .update(attorneysTable)
      .set({
        archivedAt: sql`COALESCE(${attorneysTable.archivedAt}, now())`,
        isPro: false,
        subscriptionStatus: "canceled",
      })
      .where(eq(attorneysTable.ownerId, userId));
    bustAggregateCaches();
  }

  // 3) Delete the auth user. If this fails the listings are already down and
  //    billing is stopped (safer than leaving a billed public listing), so the
  //    user can simply retry.
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch (err) {
    req.log.error(
      { err },
      "Failed to delete Supabase user during account deletion",
    );
    res.status(502).json({
      error:
        "We couldn't finish deleting your account. Your listings have been taken down and billing stopped — please try again.",
    });
    return;
  }

  // 4) Best-effort cleanup of the dangling owner link. The account is already
  //    gone, so report success even if this fails (logged for later repair).
  try {
    await db
      .update(attorneysTable)
      .set({ ownerId: null })
      .where(eq(attorneysTable.ownerId, userId));
  } catch (err) {
    req.log.error(
      { err, ownerId: userId },
      "Account deleted but failed to unlink its listings; ownerId may be dangling",
    );
  }

  res.json(
    DeleteOwnAccountResponse.parse({
      success: true,
      archivedListings,
      canceledSubscriptions,
    }),
  );
});

export default router;
