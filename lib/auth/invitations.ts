import { randomBytes } from "node:crypto";
import type { MembershipRole, PrismaClient } from "@/lib/generated/prisma/client";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CreateInvitationInput {
  companyId: string;
  email: string;
  role: MembershipRole;
  invitedById: string;
}

export async function createInvitation(prisma: PrismaClient, input: CreateInvitationInput) {
  const token = randomBytes(24).toString("base64url");
  return prisma.invitation.create({
    data: {
      companyId: input.companyId,
      email: input.email,
      role: input.role,
      invitedById: input.invitedById,
      token,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });
}

export class InvitationError extends Error {}

export interface AcceptInvitationInput {
  token: string;
  name: string;
}

/**
 * Accepting an invitation is one of two ways a Membership row gets
 * created — the other is self-service signup (lib/auth/signup.ts), which
 * creates a brand-new company with the signing-up user as its admin.
 * Invitations are for joining an *existing* company as anything else
 * (adviser, contributor, finance approver), so an adviser's per-client
 * scoping is always the result of an explicit invite, never a side
 * effect of something else.
 */
export async function acceptInvitation(prisma: PrismaClient, input: AcceptInvitationInput) {
  const invitation = await prisma.invitation.findUnique({ where: { token: input.token } });
  if (!invitation) {
    throw new InvitationError("Invitation not found");
  }
  if (invitation.acceptedAt) {
    throw new InvitationError("Invitation has already been accepted");
  }
  if (invitation.expiresAt < new Date()) {
    throw new InvitationError("Invitation has expired");
  }

  const user = await prisma.user.upsert({
    where: { email: invitation.email },
    update: {},
    create: { email: invitation.email, name: input.name },
  });

  const membership = await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: invitation.companyId } },
    update: { role: invitation.role },
    create: { userId: user.id, companyId: invitation.companyId, role: invitation.role },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  return { user, membership };
}
