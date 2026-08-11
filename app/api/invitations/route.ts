import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createInvitation } from "@/lib/auth/invitations";
import { sendEmail } from "@/lib/email/send";
import { buildInvitationEmail } from "@/lib/email/templates";
import type { MembershipRole } from "@/lib/generated/prisma/client";

/**
 * Company-wide membership invites (any role, including future Owners) —
 * Owner-only (membership:manage). A Lead inviting a contributor onto
 * *their* project specifically is a narrower, project-scoped action
 * (projectMember:invite) that doesn't exist as a route yet; it belongs
 * with the project-team UI, not here.
 */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, email, role } = (await request.json()) as {
    companyId?: string;
    email?: string;
    role?: MembershipRole;
  };
  if (!companyId || !email || !role) {
    return NextResponse.json({ error: "companyId, email and role are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, action: "membership:manage" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Only a company owner can invite members" }, { status: 403 });
    }
    throw error;
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const invitation = await createInvitation(prisma, {
    companyId,
    email,
    role,
    invitedById: currentUser.id,
  });

  const link = `${request.nextUrl.origin}/invitations/${invitation.token}`;
  try {
    await sendEmail({
      to: email,
      ...buildInvitationEmail({ link, companyName: company.name, inviterName: currentUser.name }),
    });
  } catch (error) {
    console.error("Failed to send invitation email", error);
    return NextResponse.json(
      { id: invitation.id, warning: "Invitation was created, but the email couldn't be sent." },
      { status: 201 }
    );
  }

  return NextResponse.json({ id: invitation.id }, { status: 201 });
}
