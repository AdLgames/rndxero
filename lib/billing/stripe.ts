import Stripe from "stripe";

/**
 * Thin Stripe wrapper. PLAN.md Phase 6: subscription, not per-claim
 * pricing; a firm-level plan metered by seat/client count. This file
 * only ever calls Stripe — persistence (mapping a webhook event to our
 * Subscription row) lives in lib/billing/repository.ts.
 */

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cachedClient = new Stripe(secretKey);
  return cachedClient;
}

export interface CreateCheckoutSessionParams {
  companyId: string;
  companyName: string;
  existingStripeCustomerId: string | null;
  priceId: string;
  seatCount: number;
  successUrl: string;
  cancelUrl: string;
}

/** Starts a subscription checkout for a company. Trial length is configured on the Stripe Price/Product, not here. */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.existingStripeCustomerId ?? undefined,
    client_reference_id: params.companyId,
    line_items: [{ price: params.priceId, quantity: params.seatCount }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { companyId: params.companyId, companyName: params.companyName },
    subscription_data: { metadata: { companyId: params.companyId } },
  });
}

export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
