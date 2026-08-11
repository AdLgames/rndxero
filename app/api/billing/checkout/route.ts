import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createCheckoutSession } from "@/lib/billing/stripe";

/** Starts (or restarts) a company's subscription checkout. Owner-only. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, seatCount } = (await request.json()) as { companyId?: string; seatCount?: number };
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, action: "billing:manage" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Only a company owner can manage billing" }, { status: 403 });
    }
    throw error;
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { subscription: true },
  });

  const session = await createCheckoutSession({
    companyId,
    companyName: company.name,
    existingStripeCustomerId: company.subscription?.stripeCustomerId ?? null,
    priceId,
    seatCount: seatCount ?? 1,
    successUrl: `${request.nextUrl.origin}/?billing=success`,
    cancelUrl: `${request.nextUrl.origin}/?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
