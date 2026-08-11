import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMagicLinkToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates";

/**
 * Requests a magic sign-in link for an existing user. The response is
 * identical whether or not the email matches a user, so this endpoint
 * can't be used to enumerate accounts.
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
    await sendEmail({ to: email, ...buildMagicLinkEmail({ link, context: "sign-in" }) });
  }

  return NextResponse.json({ ok: true });
}
