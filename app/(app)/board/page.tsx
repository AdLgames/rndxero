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
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">You&apos;re not a member of any company yet.</p>
      </div>
    );
  }

  const params = await searchParams;
  const companyId = params.company && companyIds.includes(params.company) ? params.company : companyIds[0];
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const currentWeekKey = getIsoWeekKey(new Date());
  const defaultFromWeekKey = shiftWeekKey(currentWeekKey, -(WEEK_COUNT - 1));
  const fromWeekKey = params.from && WEEK_KEY_PATTERN.test(params.from) ? params.from : defaultFromWeekKey;

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
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Board</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No projects to show yet.</p>
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
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{company.name} — Board</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Each lane is a project. Ghost bars are planned hours; solid bars are what got logged. This isn&apos;t a
        delivery-management view — it&apos;s the evidence record for R&amp;D uncertainty, presented at a glance.
      </p>

      <div className="mt-6">
        <BoardClient
          companyId={companyId}
          board={board}
          uncertaintiesByProject={uncertaintiesByProject}
          remappableByProject={remappableByProject}
          fromWeekKey={fromWeekKey}
          weekCount={WEEK_COUNT}
        />
      </div>
    </div>
  );
}
