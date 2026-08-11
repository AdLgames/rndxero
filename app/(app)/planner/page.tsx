import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";

export default async function PlannerIndexPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  const projectsByCompany = await Promise.all(
    companyIds.map(async (companyId) => {
      const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
      const projects = await prisma.project.findMany({
        where: { id: { in: accessibleProjectIds }, status: "ACTIVE" },
      });
      const readable = await Promise.all(
        projects.map(async (project) => ({
          project,
          canRead: await canDo(prisma, { userId: currentUser.id, companyId, projectId: project.id, action: "plan:read" }),
        }))
      );
      return { companyId, projects: readable.filter((p) => p.canRead).map((p) => p.project) };
    })
  );

  const allProjects = projectsByCompany.flatMap((c) => c.projects);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Planner</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Plan proposed hours per uncertainty per week, then compare against what actually got logged.
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {allProjects.map((project) => (
          <li key={project.id} className="rounded border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
            <Link href={`/planner/${project.id}`} className="font-medium text-black hover:underline dark:text-zinc-50">
              {project.name}
            </Link>
          </li>
        ))}
        {allProjects.length === 0 && (
          <li className="text-sm text-zinc-500 dark:text-zinc-400">No projects you can plan for yet.</li>
        )}
      </ul>
    </div>
  );
}
