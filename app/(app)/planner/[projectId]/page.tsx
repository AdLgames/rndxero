import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { computePlannedCostMinorUnits, getPlanVsActual, getCurrentPlanVersion, listPlanVersions } from "@/lib/plan/repository";
import { PlannerClient, type UncertaintyOption, type MemberOption, type CurrentPlanData, type VarianceRow } from "./PlannerClient";

export default async function PlannerPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "plan:read" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">You don&apos;t have access to this project&apos;s plan.</p>
        </div>
      );
    }
    throw error;
  }

  const canWrite = await canDo(prisma, {
    userId: currentUser.id,
    companyId: project.companyId,
    projectId,
    action: "plan:write",
  });
  const canViewCosts = await canDo(prisma, {
    userId: currentUser.id,
    companyId: project.companyId,
    projectId,
    action: "cost:read",
  });

  const [uncertainties, members, currentPlan, versions] = await Promise.all([
    prisma.uncertainty.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.projectMember.findMany({ where: { projectId }, include: { user: { select: { id: true, name: true } } } }),
    getCurrentPlanVersion(prisma, projectId),
    listPlanVersions(prisma, projectId),
  ]);

  const plannedCostMinorUnits =
    canViewCosts && currentPlan ? await computePlannedCostMinorUnits(prisma, { companyId: project.companyId, planVersion: currentPlan }) : null;

  const varianceByUncertainty = await Promise.all(
    uncertainties.map(async (u) => ({
      uncertaintyId: u.id,
      uncertaintyTitle: u.title,
      weeks: await getPlanVsActual(prisma, { projectId, uncertaintyId: u.id }),
    }))
  );
  const varianceRows: VarianceRow[] = varianceByUncertainty.flatMap((u) =>
    u.weeks.map((w) => ({ uncertaintyTitle: u.uncertaintyTitle, ...w }))
  );

  const uncertaintyOptions: UncertaintyOption[] = uncertainties.map((u) => ({ id: u.id, title: u.title }));
  const memberOptions: MemberOption[] = members.map((m) => ({ userId: m.user.id, name: m.user.name }));

  const currentPlanData: CurrentPlanData | null = currentPlan
    ? {
        versionNumber: currentPlan.versionNumber,
        note: currentPlan.note,
        totalPlannedMinutes: currentPlan.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0),
        allocations: currentPlan.plannedAllocations.map((a) => ({
          uncertaintyId: a.uncertaintyId,
          userId: a.userId,
          weekKey: a.weekKey,
          plannedMinutes: a.plannedMinutes,
        })),
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{project.name} — Plan</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        This product records proposed hours and what was actually logged. It doesn&apos;t decide what qualifies as
        R&amp;D or calculate relief.
      </p>

      <div className="mt-6">
        <PlannerClient
          companyId={project.companyId}
          projectId={projectId}
          canWrite={canWrite}
          canViewCosts={canViewCosts}
          uncertainties={uncertaintyOptions}
          members={memberOptions}
          currentPlan={currentPlanData}
          plannedCostMinorUnits={plannedCostMinorUnits}
          variance={varianceRows}
          versionCount={versions.length}
          versionHistory={versions.map((v) => ({
            versionNumber: v.versionNumber,
            note: v.note,
            createdAt: v.createdAt.toISOString(),
            supersededAt: v.supersededAt ? v.supersededAt.toISOString() : null,
            totalPlannedMinutes: v.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0),
          }))}
        />
      </div>
    </div>
  );
}
