import type { PrismaClient } from "@/lib/generated/prisma/client";

export interface NudgeCandidate {
  userId: string;
  email: string;
  name: string;
  missingProjectNames: string[];
}

/**
 * Who needs the weekly nudge for `weekKey` (BOARD-PLAN.md Phase 8.3):
 * every ProjectMember of an ACTIVE project, excluding ADVISER (they
 * submit nothing — there's nothing to nudge them about), who hasn't
 * submitted that week on that project yet. Grouped one entry per person
 * with every project they're still missing, so a person on three
 * projects gets one email, not three.
 */
export async function getNudgeCandidates(prisma: PrismaClient, weekKey: string): Promise<NudgeCandidate[]> {
  const members = await prisma.projectMember.findMany({
    where: { role: { not: "ADVISER" }, project: { status: "ACTIVE" } },
    include: {
      user: { select: { id: true, email: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  if (members.length === 0) return [];

  const projectIds = [...new Set(members.map((m) => m.projectId))];
  const submissions = await prisma.weeklySubmission.findMany({
    where: { weekKey, projectId: { in: projectIds } },
    select: { projectId: true, userId: true },
  });
  const submitted = new Set(submissions.map((s) => `${s.projectId}:${s.userId}`));

  const missingByUser = new Map<string, NudgeCandidate>();
  for (const member of members) {
    if (submitted.has(`${member.projectId}:${member.userId}`)) continue;
    const existing = missingByUser.get(member.userId);
    if (existing) {
      existing.missingProjectNames.push(member.project.name);
    } else {
      missingByUser.set(member.userId, {
        userId: member.userId,
        email: member.user.email,
        name: member.user.name,
        missingProjectNames: [member.project.name],
      });
    }
  }

  return [...missingByUser.values()];
}
