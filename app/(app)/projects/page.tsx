import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * /projects itself has no content of its own — it always resolves to a
 * specific project's detail pane, "featured" as the most recently active
 * one, so the dashboard never opens on an empty right pane once at least
 * one project exists. The empty state (no projects at all yet) is the
 * only thing actually rendered here.
 */
export default async function ProjectsIndexPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const ownerCompanyIds = currentUser.memberships.filter((m) => m.role === "OWNER").map((m) => m.companyId);
  if (ownerCompanyIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-16 text-center">
        <p className="max-w-[40ch] text-[14.5px] text-text-secondary">You need to be a company owner to view projects.</p>
      </div>
    );
  }

  const mostRecentlyActive = await prisma.weeklySubmission.findFirst({
    where: { companyId: { in: ownerCompanyIds } },
    orderBy: { submittedAt: "desc" },
    select: { projectId: true },
  });
  if (mostRecentlyActive) {
    redirect(`/projects/${mostRecentlyActive.projectId}`);
  }

  const mostRecentlyCreated = await prisma.project.findFirst({
    where: { companyId: { in: ownerCompanyIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (mostRecentlyCreated) {
    redirect(`/projects/${mostRecentlyCreated.id}`);
  }

  return (
    <div className="flex h-full items-center justify-center px-6 py-16 text-center">
      <p className="max-w-[40ch] text-[14.5px] text-text-secondary">No projects yet — use &ldquo;New R&amp;D project&rdquo; to add one.</p>
    </div>
  );
}
