import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo } from "@/lib/authz/service";
import { listCompanyProjects } from "@/lib/projects/repository";
import { InviteForm } from "./InviteForm";
import { ProjectRow, type ProjectRowData } from "./ProjectRow";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const adminCompanyIds = currentUser.memberships.filter((m) => m.role === "OWNER").map((m) => m.companyId);
  const companies = await prisma.company.findMany({ where: { id: { in: adminCompanyIds } } });

  const companiesWithProjects = await Promise.all(
    companies.map(async (company) => {
      const [projects, members, canWriteCost] = await Promise.all([
        listCompanyProjects(prisma, company.id),
        prisma.membership.findMany({
          where: { companyId: company.id, status: "ACTIVE" },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        }),
        canDo(prisma, { userId: currentUser.id, companyId: company.id, action: "cost:write" }),
      ]);

      const rows: ProjectRowData[] = await Promise.all(
        projects.map(async (project) => {
          const [total, projectMembers, openUncertainty] = await Promise.all([
            prisma.weeklySubmission.aggregate({ where: { projectId: project.id }, _sum: { minutes: true } }),
            prisma.projectMember.findMany({ where: { projectId: project.id }, include: { user: { select: { name: true } } } }),
            prisma.uncertainty.findFirst({ where: { projectId: project.id, outcome: "OPEN" }, orderBy: { createdAt: "asc" } }),
          ]);
          return {
            id: project.id,
            name: project.name,
            archived: project.status !== "ACTIVE",
            startDate: project.startDate.toISOString(),
            competentProfessionals: project.competentProfessionals.map((cp) => cp.name).join(", "),
            minutes: total._sum.minutes ?? 0,
            openUncertaintyTitle: openUncertainty?.title ?? null,
            members: projectMembers.map((m) => ({ id: m.id, name: m.user.name, costCategory: m.costCategory })),
          };
        })
      );

      return { company, rows, members, canWriteCost };
    })
  );

  return (
    <div className="px-12 py-11">
      {companiesWithProjects.map(({ company, rows, members, canWriteCost }, i) => (
        <section key={company.id} className={i > 0 ? "mt-16 border-t border-black/[.06] pt-11" : ""}>
          <div className="mb-8">
            <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{companiesWithProjects.length > 1 ? company.name : "Projects"}</h2>
            <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
              Every project is a claimable line of R&amp;D. Set who did the work and when it began — the rest is
              captured week by week. Use &ldquo;New R&amp;D project&rdquo; above to add one.
            </p>
          </div>

          <div className="grid grid-cols-[1.6fr_1fr] items-start gap-7">
            <div className="flex flex-col gap-3">
              {rows.map((project) => (
                <ProjectRow key={project.id} project={project} companyId={company.id} canWriteCost={canWriteCost} />
              ))}
              {rows.length === 0 && <p className="text-sm text-text-tertiary">No projects yet — use &ldquo;New R&amp;D project&rdquo; above to add one.</p>}
            </div>

            <InviteForm companyId={company.id} seats={members.map((m) => ({ id: m.id, name: m.user.name, role: m.role }))} />
          </div>
        </section>
      ))}

      {companiesWithProjects.length === 0 && <p className="text-sm text-text-secondary">You need to be a company owner to create projects.</p>}
    </div>
  );
}
