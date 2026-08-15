import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Everything the app holds that's tied to one user, for the "export my
 * data" self-service request. Deliberately scoped to what this specific
 * user contributed or is named on — not a company-wide dump, and not
 * gated behind any authz action beyond "this is your own account."
 */
export async function exportUserData(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true, deletionRequestedAt: true },
  });

  const [
    memberships,
    projectMemberships,
    weeklySubmissions,
    comments,
    amendmentsAuthored,
    payRates,
    directCostsEntered,
    competentOn,
    invitationsSent,
    auditLogEntries,
  ] = await Promise.all([
    prisma.membership.findMany({ where: { userId }, include: { company: { select: { name: true } } } }),
    prisma.projectMember.findMany({ where: { userId }, include: { project: { select: { name: true } } } }),
    prisma.weeklySubmission.findMany({
      where: { userId },
      include: { project: { select: { name: true } }, notes: true },
      orderBy: { weekKey: "asc" },
    }),
    prisma.submissionComment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.amendment.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.rate.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.directCost.findMany({ where: { enteredById: userId }, orderBy: { createdAt: "asc" } }),
    prisma.projectCompetentProfessional.findMany({ where: { userId }, include: { project: { select: { name: true } } } }),
    prisma.invitation.findMany({ where: { invitedById: userId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    memberships: memberships.map((m) => ({ companyName: m.company.name, role: m.role, status: m.status, createdAt: m.createdAt })),
    projectMemberships: projectMemberships.map((m) => ({ projectName: m.project.name, role: m.role, costCategory: m.costCategory })),
    weeklySubmissions: weeklySubmissions.map((s) => ({
      projectName: s.project.name,
      weekKey: s.weekKey,
      minutes: s.minutes,
      basis: s.basis,
      submittedAt: s.submittedAt,
      notes: s.notes.map((n) => ({ type: n.type, body: n.body, minutes: n.minutes, evidenceRef: n.evidenceRef, createdAt: n.createdAt })),
    })),
    comments,
    amendmentsAuthored,
    payRates,
    directCostsEntered,
    namedAsCompetentProfessionalOn: competentOn.map((c) => ({ projectName: c.project.name, name: c.name })),
    invitationsSent,
    auditLogEntries,
  };
}

export type UserDataExport = Awaited<ReturnType<typeof exportUserData>>;
