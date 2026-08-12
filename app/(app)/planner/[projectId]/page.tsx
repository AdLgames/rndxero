import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import { computePlannedCostMinorUnits, getPlanVsActual, getCurrentPlanVersion, listPlanVersions } from "@/lib/plan/repository";
import { PlannerClient, type UncertaintyOption, type CurrentPlanData, type VarianceRow } from "./PlannerClient";

const WEEK_SPAN = 5;
const WEEK_KEY_PATTERN = /^\d{4}-W\d{2}$/;

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
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
        <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
          <p className="text-[15px] text-text-secondary">You don&apos;t have access to this project&apos;s plan.</p>
        </div>
      );
    }
    throw error;
  }

  const canWrite = await canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "plan:write" });
  const canViewCosts = await canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "cost:read" });

  const currentWeekKey = getIsoWeekKey(new Date());
  const searchParamsResolved = await searchParams;
  const fromWeekKey = searchParamsResolved.from && WEEK_KEY_PATTERN.test(searchParamsResolved.from) ? searchParamsResolved.from : currentWeekKey;
  const weekKeys = Array.from({ length: WEEK_SPAN }, (_, i) => shiftWeekKey(fromWeekKey, i));
  const prevFrom = shiftWeekKey(fromWeekKey, -WEEK_SPAN);
  const nextFrom = shiftWeekKey(fromWeekKey, WEEK_SPAN);

  const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId: project.companyId });
  const siblingProjects = await prisma.project.findMany({
    where: { id: { in: accessibleProjectIds }, companyId: project.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const readableSiblings = (
    await Promise.all(
      siblingProjects.map(async (p) => ({
        p,
        readable: await canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId: p.id, action: "plan:read" }),
      }))
    )
  )
    .filter((s) => s.readable)
    .map((s) => s.p);

  const [uncertainties, currentPlan, versions] = await Promise.all([
    prisma.uncertainty.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
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
  const varianceRows: VarianceRow[] = varianceByUncertainty.flatMap((u) => u.weeks.map((w) => ({ uncertaintyTitle: u.uncertaintyTitle, ...w })));
  const actualMinutesByWeek: Record<string, number> = {};
  for (const row of varianceRows) {
    actualMinutesByWeek[row.weekKey] = (actualMinutesByWeek[row.weekKey] ?? 0) + row.actualMinutes;
  }

  const uncertaintyOptions: UncertaintyOption[] = uncertainties.map((u) => ({ id: u.id, title: u.title }));

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
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{project.name}</h2>
          <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
            Propose hours per uncertainty, per week. Trace compares them to what gets logged.
          </p>
        </div>
        {siblingProjects.length > 1 && (
          <div className="inline-flex flex-wrap items-center gap-1 rounded-[10px] bg-control-track p-[3px] sm:shrink-0">
            {readableSiblings.map((p) => (
              <Link
                key={p.id}
                href={`/planner/${p.id}`}
                className={`rounded-[8px] px-[15px] py-[7px] text-[13px] transition-all duration-150 ease-out ${
                  p.id === projectId ? "bg-white font-[590] text-text shadow-[0_1px_3px_rgba(0,0,0,.09)]" : "font-[500] text-text-secondary hover:text-text"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex items-center rounded-[10px] bg-control-track p-[3px]">
          <Link href={`/planner/${projectId}?from=${prevFrom}`} aria-label="Previous weeks" className="rounded-[8px] px-3 py-[7px] text-[13px] font-[500] text-text-secondary transition-colors duration-150 hover:text-text">
            ←
          </Link>
          <span className="px-3 py-[7px] text-[13px] font-[590] text-text">
            {weekKeys[0]} – {weekKeys[weekKeys.length - 1]}
          </span>
          <Link href={`/planner/${projectId}?from=${nextFrom}`} aria-label="Next weeks" className="rounded-[8px] px-3 py-[7px] text-[13px] font-[500] text-text-secondary transition-colors duration-150 hover:text-text">
            →
          </Link>
        </div>
      </div>

      <PlannerClient
        companyId={project.companyId}
        projectId={projectId}
        canWrite={canWrite}
        canViewCosts={canViewCosts}
        uncertainties={uncertaintyOptions}
        currentPlan={currentPlanData}
        plannedCostMinorUnits={plannedCostMinorUnits}
        weekKeys={weekKeys}
        currentWeekKey={currentWeekKey}
        actualMinutesByWeek={actualMinutesByWeek}
        versionHistory={versions.map((v) => ({
          versionNumber: v.versionNumber,
          note: v.note,
          createdAt: v.createdAt.toISOString(),
          supersededAt: v.supersededAt ? v.supersededAt.toISOString() : null,
          totalPlannedMinutes: v.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0),
        }))}
      />
    </div>
  );
}
