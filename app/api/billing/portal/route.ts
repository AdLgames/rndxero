import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageCompany, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { createPortalSession } from "@/lib/billing/stripe";

/** Opens the Stripe Customer Portal for a company's existing subscription. Admin-only. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId } = (await request.json()) as { companyId?: string };
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const role = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!role || !canManageCompany({ role, companyId })) {
    return NextResponse.json({ error: "Only a company admin can manage billing" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({ where: { companyId } });
  if (!subscription) {
    return NextResponse.json({ error: "No subscription for this company" }, { status: 404 });
  }

  const session = await createPortalSession(subscription.stripeCustomerId, `${request.nextUrl.origin}/`);
  return NextResponse.json({ url: session.url });
}
