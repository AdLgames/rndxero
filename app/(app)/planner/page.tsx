import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { Panel } from "@/app/components/Panel";
import { eyebrow } from "@/app/components/ui";

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
      <p className={eyebrow}>04 · Planner</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Propose hours per uncertainty</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Plan proposed hours per uncertainty per week, then compare against what actually got logged.
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {allProjects.map((project) => (
          <Panel key={project.id} as="li" className="p-3 text-sm">
            <Link href={`/planner/${project.id}`} className="font-semibold text-foreground hover:text-steel-dark">
              {project.name}
            </Link>
          </Panel>
        ))}
        {allProjects.length === 0 && <li className="text-sm text-foreground/50">No projects you can plan for yet.</li>}
      </ul>
    </div>
  );
}
