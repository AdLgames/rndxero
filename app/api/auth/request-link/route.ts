import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMagicLinkToken } from "@/lib/auth/session";

/**
 * Requests a magic sign-in link for an existing user. No transactional
 * email provider is wired up yet (Phase 6 territory, and needs a real
 * account with a real domain) — in non-production this logs the link to
 * the server console instead of sending it. The response is identical
 * whether or not the email matches a user, so this endpoint can't be used
 * to enumerate accounts.
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
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] magic sign-in link for ${email}: ${link}`);
    } else {
      // TODO(Phase 6): send via a transactional email provider instead of
      // logging. Never log a live magic link in production.
      console.warn("No email provider configured — magic link was not sent.");
    }
  }

  return NextResponse.json({ ok: true });
}
