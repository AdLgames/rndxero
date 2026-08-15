import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listCompanyProjects } from "@/lib/projects/repository";
import { ProjectRail, type RailProject } from "./ProjectRail";

/**
 * A dashboard shell, not a page-per-click: this layout renders the
 * project rail once and keeps it mounted while `/projects/[projectId]`
 * swaps in the detail pane on the right — Next.js layouts don't remount
 * on a child route's navigation, so switching projects never re-fetches
 * or re-renders the list itself. On narrow screens the rail and the
 * detail pane can't sit side by side, so ProjectRail hides one or the
 * other based on the current path instead (see that component).
 */
export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const ownerCompanyIds = currentUser.memberships.filter((m) => m.role === "OWNER").map((m) => m.companyId);
  const companies = ownerCompanyIds.length ? await prisma.company.findMany({ where: { id: { in: ownerCompanyIds } } }) : [];

  const companiesWithProjects = await Promise.all(
    companies.map(async (company) => {
      const projects = await listCompanyProjects(prisma, company.id);
      const rows: RailProject[] = await Promise.all(
        projects.map(async (project) => {
          const [totals, lead] = await Promise.all([
            prisma.weeklySubmission.aggregate({ where: { projectId: project.id }, _sum: { minutes: true } }),
            prisma.projectMember.findFirst({ where: { projectId: project.id, role: "LEAD" }, include: { user: { select: { name: true } } } }),
          ]);
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            ownerName: lead?.user.name ?? null,
            minutes: totals._sum.minutes ?? 0,
          };
        })
      );
      return { company, rows };
    })
  );

  const allProjects = companiesWithProjects.flatMap((c) => c.rows);

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:items-stretch">
      <div className="flex flex-col border-black/[.055] lg:w-[340px] lg:shrink-0 lg:border-r">
        <div className="border-b border-black/[.055] px-6 py-5">
          <h2 className="m-0 text-[19px] font-[640] tracking-[-0.026em] text-text">Projects</h2>
        </div>
        <ProjectRail groups={companiesWithProjects.map(({ company, rows }) => ({ companyId: company.id, companyName: company.name, rows }))} />
        {allProjects.length === 0 && (
          <p className="px-6 py-5 text-[13.5px] text-text-secondary">
            {companies.length === 0 ? "You need to be a company owner to view projects." : "No projects yet — use “New R&D project” above to add one."}
          </p>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
