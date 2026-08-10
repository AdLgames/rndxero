import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripeClient, verifyWebhookSignature } from "@/lib/billing/stripe";
import { upsertSubscriptionFromStripe } from "@/lib/billing/repository";
import type Stripe from "stripe";

/**
 * Stripe webhook — the only place subscription entitlement is written.
 * Cancellation only ever changes Subscription.status; it never deletes
 * evidence data (see RETENTION.md).
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.client_reference_id ?? session.metadata?.companyId;
      if (companyId && session.customer && session.subscription) {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscriptionFromStripe(prisma, {
          companyId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          seatCount: subscription.items.data[0]?.quantity ?? 1,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.companyId;
      if (companyId) {
        await upsertSubscriptionFromStripe(prisma, {
          companyId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          seatCount: subscription.items.data[0]?.quantity ?? 1,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
