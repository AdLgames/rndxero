import type Stripe from "stripe";
import type { PrismaClient, SubscriptionStatus } from "@/lib/generated/prisma/client";

/** Maps Stripe's subscription status vocabulary onto our narrower enum. */
export function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "CANCELED";
    default:
      return "PAST_DUE";
  }
}

export interface UpsertSubscriptionFromStripeInput {
  companyId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: Stripe.Subscription.Status;
  seatCount: number;
}

/**
 * Subscription is not append-only (unlike evidence) — it's live billing
 * state, so this legitimately updates in place as Stripe's webhook
 * reports new status.
 */
export async function upsertSubscriptionFromStripe(
  prisma: PrismaClient,
  input: UpsertSubscriptionFromStripeInput
) {
  const status = mapStripeStatus(input.status);
  return prisma.subscription.upsert({
    where: { companyId: input.companyId },
    update: {
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status,
      seatCount: input.seatCount,
    },
    create: {
      companyId: input.companyId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status,
      seatCount: input.seatCount,
    },
  });
}

/** True once a company's subscription entitles it to use the product. */
export function isEntitled(status: SubscriptionStatus): boolean {
  return status === "TRIALING" || status === "ACTIVE";
}
