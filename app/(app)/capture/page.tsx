import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, getWeekBoundaries } from "@/lib/capture/week-key";
import { getOpenUncertainties, getPrefillMinutes } from "@/lib/capture/repository";
import { eyebrow } from "@/app/components/ui";
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
  const { start } = getWeekBoundaries(weekKey);
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
      const [uncertainties, prefillMinutes, existingSubmission] = await Promise.all([
        getOpenUncertainties(prisma, project.id),
        getPrefillMinutes(prisma, { projectId: project.id, userId: currentUser.id, previousWeekKey }),
        prisma.weeklySubmission.findUnique({
          where: {
            projectId_userId_weekKey: { projectId: project.id, userId: currentUser.id, weekKey },
          },
        }),
      ]);

      return {
        projectId: project.id,
        projectName: project.name,
        companyId: project.companyId,
        uncertainties: uncertainties.map((u) => ({ id: u.id, title: u.title })),
        prefillMinutes,
        existing: existingSubmission
          ? { minutes: existingSubmission.minutes, basis: existingSubmission.basis, locked: existingSubmission.lockedAt !== null }
          : null,
      };
    })
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className={eyebrow}>02 · Capture</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">This week&apos;s R&amp;D time</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Week {weekKey}. Confirm what you worked on — takes under a minute.
      </p>
      <div className="mt-6">
        <CaptureClient weekKey={weekKey} projects={projects} />
      </div>
    </div>
  );
}
