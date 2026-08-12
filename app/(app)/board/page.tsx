import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import { getBoardData } from "@/lib/board/repository";
import { BoardClient, type LaneUncertaintyOption } from "./BoardClient";

const VISIBLE_WEEK_COUNT = 12;
/** Pre-fetched once, well beyond what's shown at once, so paging forward/back through nearby weeks in BoardClient never needs a fresh request. */
const FETCH_WEEKS_BACK = 24;
const FETCH_WEEKS_FORWARD = 12;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  if (companyIds.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
        <p className="text-[15px] text-text-secondary">You&apos;re not a member of any company yet.</p>
      </div>
    );
  }

  const params = await searchParams;
  const companyId = params.company && companyIds.includes(params.company) ? params.company : companyIds[0];
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const currentWeekKey = getIsoWeekKey(new Date());
  const fetchFromWeekKey = shiftWeekKey(currentWeekKey, -FETCH_WEEKS_BACK);
  const fetchWeekCount = FETCH_WEEKS_BACK + FETCH_WEEKS_FORWARD + 1;

  const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
  const projects = await prisma.project.findMany({
    where: { id: { in: accessibleProjectIds } },
    select: { id: true },
  });
  const readableProjectIds = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      readable: await canDo(prisma, { userId: currentUser.id, companyId, projectId: p.id, action: "note:read" }),
      remappable: await canDo(prisma, { userId: currentUser.id, companyId, projectId: p.id, action: "note:remap" }),
    }))
  );
  const projectIds = readableProjectIds.filter((p) => p.readable).map((p) => p.id);
  const remappableByProject = Object.fromEntries(readableProjectIds.map((p) => [p.id, p.remappable]));

  if (projectIds.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
        <h2 className="m-0 mb-7 text-[30px] font-[640] tracking-[-0.028em] text-text">Board</h2>
        <p className="text-[15px] text-text-secondary">No projects to show yet.</p>
      </div>
    );
  }

  const [board, uncertainties] = await Promise.all([
    getBoardData(prisma, { companyId, projectIds, fromWeekKey: fetchFromWeekKey, weekCount: fetchWeekCount }),
    prisma.uncertainty.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, title: true, projectId: true } }),
  ]);

  const uncertaintiesByProject: Record<string, LaneUncertaintyOption[]> = {};
  for (const u of uncertainties) {
    (uncertaintiesByProject[u.projectId] ??= []).push({ id: u.id, title: u.title });
  }

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{companyIds.length > 1 ? `Board — ${company.name}` : "Board"}</h2>
      <p className="m-0 mt-[7px] mb-7 max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
        The at-a-glance evidence view, not a delivery tracker. Pale bars are planned hours; coloured bars are what got
        logged.
      </p>

      <BoardClient
        companyId={companyId}
        board={board}
        uncertaintiesByProject={uncertaintiesByProject}
        remappableByProject={remappableByProject}
        visibleWeekCount={VISIBLE_WEEK_COUNT}
      />
    </div>
  );
}
