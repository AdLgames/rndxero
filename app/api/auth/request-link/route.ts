import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMagicLinkToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates";

/**
 * Requests a magic sign-in link for an existing user. The response is
 * identical whether or not the email matches a user — and identical even
 * if sending fails — so this endpoint can't be used to enumerate
 * accounts or to distinguish "no account" from "delivery is broken."
 * Delivery failures are only visible server-side, in logs.
 */
export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = createMagicLinkToken(email);
    const link = `${request.nextUrl.origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
    try {
      await sendEmail({ to: email, ...buildMagicLinkEmail({ link, context: "sign-in" }) });
    } catch (error) {
      console.error("Failed to send sign-in email", error);
    }
  }

  return NextResponse.json({ ok: true });
}
