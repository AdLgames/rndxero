import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signUpCompany } from "@/lib/auth/signup";
import { createMagicLinkToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates";

/**
 * Creates a new company (with the requester as its admin) and emails a
 * magic sign-in link to confirm — same email-ownership check as regular
 * sign-in (lib/auth/session.ts), just skipping the "does this user exist
 * yet" branch since signup is exactly the case where they don't.
 *
 * The company is created before the email is sent, so a delivery failure
 * must not surface as an opaque crash: it's reported as a clear error,
 * and signUpCompany is idempotent on (user, companyName) specifically so
 * retrying this endpoint after a failed send reuses the same company
 * instead of piling up duplicates.
 */
export async function POST(request: NextRequest) {
  const { email, name, companyName } = (await request.json()) as {
    email?: string;
    name?: string;
    companyName?: string;
  };
  if (!email || !name || !companyName) {
    return NextResponse.json({ error: "email, name and companyName are required" }, { status: 400 });
  }

  await signUpCompany(prisma, { email, name, companyName });

  const token = createMagicLinkToken(email);
  const link = `${request.nextUrl.origin}/api/auth/callback?token=${encodeURIComponent(token)}`;

  try {
    await sendEmail({ to: email, ...buildMagicLinkEmail({ link, context: "signup" }) });
  } catch (error) {
    console.error("Failed to send signup confirmation email", error);
    return NextResponse.json(
      {
        error:
          "Your company was created, but the confirmation email couldn't be sent. Try signing up again with the same details once email delivery is fixed.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
