import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, getWeekBoundaries } from "@/lib/capture/week-key";
import { getOpenUncertainties, getPrefillMinutes } from "@/lib/capture/repository";
import { badgeAccent } from "@/app/components/ui";
import { CaptureClient, type ProjectCaptureData } from "./CaptureClient";

const WEEK_KEY_PATTERN = /^\d{4}-W\d{2}$/;

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; project?: string }>;
}) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const params = await searchParams;
  const weekKey = params.week && WEEK_KEY_PATTERN.test(params.week) ? params.week : getIsoWeekKey(new Date());
  const { start, end } = getWeekBoundaries(weekKey);
  const previousWeekKey = getIsoWeekKey(new Date(start.getTime() - 24 * 60 * 60 * 1000));

  // Every company the user belongs to, not just one — someone can be a
  // Contributor on one company's project and an Owner of their own.
  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  const accessibleProjectIdsByCompany = await Promise.all(
    companyIds.map((companyId) => listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId }))
  );
  let accessibleProjectIds = [...new Set(accessibleProjectIdsByCompany.flat())];
  if (params.project) {
    accessibleProjectIds = accessibleProjectIds.filter((id) => id === params.project);
  }

  const activeProjects = await prisma.project.findMany({
    where: { id: { in: accessibleProjectIds }, status: "ACTIVE" },
  });

  const projects: ProjectCaptureData[] = await Promise.all(
    activeProjects.map(async (project) => {
      const [uncertainties, prefillMinutes, existingSubmission, repoLink] = await Promise.all([
        getOpenUncertainties(prisma, project.id),
        getPrefillMinutes(prisma, { projectId: project.id, userId: currentUser.id, previousWeekKey }),
        prisma.weeklySubmission.findUnique({
          where: {
            projectId_userId_weekKey: { projectId: project.id, userId: currentUser.id, weekKey },
          },
        }),
        prisma.githubRepoLink.findFirst({ where: { projectId: project.id } }),
      ]);

      // Commit-signal footer: how many suggestions this repo's webhook produced this week.
      const commitCount = repoLink
        ? await prisma.suggestion.count({
            where: { repoLinkId: repoLink.id, createdAt: { gte: start, lt: end } },
          })
        : 0;

      return {
        projectId: project.id,
        projectName: project.name,
        companyId: project.companyId,
        uncertainties: uncertainties.map((u) => ({ id: u.id, title: u.title })),
        prefillMinutes,
        existing: existingSubmission
          ? { minutes: existingSubmission.minutes, basis: existingSubmission.basis, locked: existingSubmission.lockedAt !== null }
          : null,
        commitSignal: repoLink && commitCount > 0 ? { repoFullName: repoLink.repoFullName, count: commitCount } : null,
      };
    })
  );

  return (
    <div className="mx-auto max-w-[800px] px-12 py-13">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">This week</h2>
        <span className={badgeAccent}>{weekKey}</span>
      </div>
      <p className="m-0 mb-[34px] text-[15px] leading-[1.5] text-text-secondary">
        Confirm what you worked on. Under a minute — refine hours any time before the week is locked.
      </p>
      <CaptureClient weekKey={weekKey} projects={projects} />
    </div>
  );
}
