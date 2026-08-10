import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canLogOwnTime, type MembershipLike } from "@/lib/auth/roles";
import { buildWeekWindow } from "@/lib/capture/weekly-digest";
import { CaptureForm } from "./CaptureForm";

export default async function CapturePage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = (currentUser.memberships as MembershipLike[])
    .filter((m) => canLogOwnTime(m))
    .map((m) => m.companyId);

  const projects = await prisma.project.findMany({
    where: { companyId: { in: companyIds }, status: "ACTIVE" },
    select: { id: true, name: true, companyId: true },
    orderBy: { name: "asc" },
  });

  const { weekStart, weekEnd } = buildWeekWindow(new Date());

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">This week&apos;s R&amp;D time</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
        {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
        Confirm what you worked on — takes under a minute.
      </p>
      <div className="mt-6">
        <CaptureForm
          projects={projects}
          weekStart={weekStart.toISOString()}
          weekEnd={weekEnd.toISOString()}
        />
      </div>
    </div>
  );
}
