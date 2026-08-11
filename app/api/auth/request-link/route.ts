import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMagicLinkIfAllowed } from "@/lib/auth/magic-link";

/**
 * Requests a magic sign-in link for an existing user. The response is
 * identical whether or not the email matches a user — and identical even
 * if sending fails or is suppressed by the cooldown — so this endpoint
 * can't be used to enumerate accounts or to distinguish "no account"
 * from "delivery is broken" or "already sent recently." Delivery
 * failures are only visible server-side, in logs.
 */
export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    try {
      await sendMagicLinkIfAllowed(prisma, user, { origin: request.nextUrl.origin, context: "sign-in" });
    } catch (error) {
      console.error("Failed to send sign-in email", error);
    }
  }

  return NextResponse.json({ ok: true });
}
