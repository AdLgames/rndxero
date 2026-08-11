import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import { getBoardData } from "@/lib/board/repository";
import { BoardClient, type LaneUncertaintyOption } from "./BoardClient";

const WEEK_COUNT = 12;
const WEEK_KEY_PATTERN = /^\d{4}-W\d{2}$/;

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; company?: string }>;
}) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  if (companyIds.length === 0) {
    return (
      <div className="px-12 py-11">
        <p className="text-[15px] text-text-secondary">You&apos;re not a member of any company yet.</p>
      </div>
    );
  }

  const params = await searchParams;
  const companyId = params.company && companyIds.includes(params.company) ? params.company : companyIds[0];
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const currentWeekKey = getIsoWeekKey(new Date());
  const defaultFromWeekKey = shiftWeekKey(currentWeekKey, -(WEEK_COUNT - 1));
  const fromWeekKey = params.from && WEEK_KEY_PATTERN.test(params.from) ? params.from : defaultFromWeekKey;
  const lastWeekKey = shiftWeekKey(fromWeekKey, WEEK_COUNT - 1);
  const prevFrom = shiftWeekKey(fromWeekKey, -WEEK_COUNT);
  const nextFrom = shiftWeekKey(fromWeekKey, WEEK_COUNT);

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

  const pager = (
    <div className="inline-flex shrink-0 items-center rounded-[10px] bg-control-track p-[3px]">
      <Link
        href={`/board?company=${companyId}&from=${prevFrom}`}
        aria-label="Previous 12 weeks"
        className="rounded-[8px] px-[13px] py-[7px] text-[13px] font-[500] text-text-secondary transition-colors duration-150 hover:text-text"
      >
        ←
      </Link>
      <span className="px-[13px] py-[7px] text-[13px] font-[590] text-text">
        {fromWeekKey} – {lastWeekKey}
      </span>
      <Link
        href={`/board?company=${companyId}&from=${nextFrom}`}
        aria-label="Next 12 weeks"
        className="rounded-[8px] px-[13px] py-[7px] text-[13px] font-[500] text-text-secondary transition-colors duration-150 hover:text-text"
      >
        →
      </Link>
    </div>
  );

  if (projectIds.length === 0) {
    return (
      <div className="px-12 py-11">
        <div className="mb-7 flex items-end justify-between">
          <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Board</h2>
          {pager}
        </div>
        <p className="text-[15px] text-text-secondary">No projects to show yet.</p>
      </div>
    );
  }

  const [board, uncertainties] = await Promise.all([
    getBoardData(prisma, { companyId, projectIds, fromWeekKey, weekCount: WEEK_COUNT }),
    prisma.uncertainty.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, title: true, projectId: true } }),
  ]);

  const uncertaintiesByProject: Record<string, LaneUncertaintyOption[]> = {};
  for (const u of uncertainties) {
    (uncertaintiesByProject[u.projectId] ??= []).push({ id: u.id, title: u.title });
  }

  return (
    <div className="px-12 py-11">
      <div className="mb-7 flex items-end justify-between gap-6">
        <div>
          <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{companyIds.length > 1 ? `Board — ${company.name}` : "Board"}</h2>
          <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
            The at-a-glance evidence view, not a delivery tracker. Pale bars are planned hours; coloured bars are what
            got logged.
          </p>
        </div>
        {pager}
      </div>

      <BoardClient companyId={companyId} board={board} uncertaintiesByProject={uncertaintiesByProject} remappableByProject={remappableByProject} />
    </div>
  );
}
