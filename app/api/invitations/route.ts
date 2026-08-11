import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageCompany, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { createInvitation } from "@/lib/auth/invitations";
import { sendEmail } from "@/lib/email/send";
import { buildInvitationEmail } from "@/lib/email/templates";
import type { MembershipRole } from "@/lib/generated/prisma/client";

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

  const currentRole = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!currentRole || !canManageCompany({ role: currentRole, companyId })) {
    return NextResponse.json({ error: "Only a company admin can invite members" }, { status: 403 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const invitation = await createInvitation(prisma, {
    companyId,
    email,
    role,
    invitedById: currentUser.id,
  });

  const link = `${request.nextUrl.origin}/invitations/${invitation.token}`;
  await sendEmail({
    to: email,
    ...buildInvitationEmail({ link, companyName: company.name, inviterName: currentUser.name }),
  });

  return NextResponse.json({ id: invitation.id }, { status: 201 });
}
