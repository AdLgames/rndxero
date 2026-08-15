import type { PrismaClient, ProjectStatus, QualificationStatus } from "@/lib/generated/prisma/client";
import { getCurrentPlanVersion } from "@/lib/plan/repository";

/** One card on the portfolio board — a project, not a week. */
export interface PortfolioCard {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  qualificationStatus: QualificationStatus;
  ownerName: string | null;
  /** All-time totals, same figures the project detail page shows (pack.totals). */
  loggedMinutes: number;
  plannedMinutes: number;
  openChallengeCount: number;
}

/**
 * The portfolio view of a company's projects — one card per project,
 * grouped by ProjectStatus (its phase-gate stage) rather than the old
 * per-week evidence lanes. The weekly evidence detail this replaced on
 * /board still lives on each project's own detail page (its calendar
 * planner), so nothing here duplicates or loses that — this is a
 * higher-altitude "where does everything stand" view.
 */
export async function getPortfolioBoardData(
  prisma: PrismaClient,
  params: { companyId: string; projectIds: string[] }
): Promise<PortfolioCard[]> {
  if (params.projectIds.length === 0) return [];

  const [projects, leads, loggedByProject, openByProject, plansByProject] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: params.projectIds }, companyId: params.companyId },
      select: { id: true, name: true, status: true, qualificationStatus: true },
      orderBy: { name: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId: { in: params.projectIds }, role: "LEAD" },
      select: { projectId: true, user: { select: { name: true } } },
    }),
    prisma.weeklySubmission.groupBy({
      by: ["projectId"],
      where: { projectId: { in: params.projectIds } },
      _sum: { minutes: true },
    }),
    prisma.uncertainty.groupBy({
      by: ["projectId"],
      where: { projectId: { in: params.projectIds }, outcome: "OPEN" },
      _count: { _all: true },
    }),
    Promise.all(params.projectIds.map(async (id) => [id, await getCurrentPlanVersion(prisma, id)] as const)),
  ]);

  const leadByProject = new Map(leads.map((l) => [l.projectId, l.user.name]));
  const loggedMap = new Map(loggedByProject.map((r) => [r.projectId, r._sum.minutes ?? 0]));
  const openMap = new Map(openByProject.map((r) => [r.projectId, r._count._all]));
  const plannedMap = new Map(
    plansByProject.map(([id, plan]) => [id, (plan?.plannedAllocations ?? []).reduce((sum, a) => sum + a.plannedMinutes, 0)])
  );

  return projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    status: p.status,
    qualificationStatus: p.qualificationStatus,
    ownerName: leadByProject.get(p.id) ?? null,
    loggedMinutes: loggedMap.get(p.id) ?? 0,
    plannedMinutes: plannedMap.get(p.id) ?? 0,
    openChallengeCount: openMap.get(p.id) ?? 0,
  }));
}
