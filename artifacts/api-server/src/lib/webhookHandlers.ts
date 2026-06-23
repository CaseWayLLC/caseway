import type { Request, Response } from "express";
import { getStripeSync } from "./stripeClient";
import { reconcileBilling } from "./billing";

/**
 * Verifies and processes a Stripe webhook, then refreshes the denormalized
 * billing columns. The route registers this with express.raw(), so req.body is
 * the raw Buffer required for signature verification. The webhook signing
 * secret is read from the managed-webhook record when not set on the client.
 */
export async function handleStripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.header("stripe-signature");
  try {
    const sync = await getStripeSync();
    await sync.processWebhook(req.body as Buffer, signature);
    await reconcileBilling();
    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook processing failed");
    res.status(400).json({ error: "Webhook processing failed" });
  }
}
