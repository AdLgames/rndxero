import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signUpCompany } from "@/lib/auth/signup";
import { sendMagicLinkIfAllowed } from "@/lib/auth/magic-link";

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
 * instead of piling up duplicates. sendMagicLinkIfAllowed additionally
 * cools down repeat sends to the same address, so a double-click, a
 * reload, or a retry from a second tab produces exactly one email, not
 * one per request.
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

  const { user } = await signUpCompany(prisma, { email, name, companyName });

  try {
    await sendMagicLinkIfAllowed(prisma, user, { origin: request.nextUrl.origin, context: "signup" });
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
