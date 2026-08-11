import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listCompanyProjects } from "@/lib/projects/repository";
import { badgeAccent, badgeNeutral, buttonPrimary } from "@/app/components/ui";
import { ProjectForm } from "./ProjectForm";
import { InviteForm } from "./InviteForm";

function hoursLabel(minutes: number): { value: string; unit: string } {
  return { value: (minutes / 60).toFixed(0), unit: "h" };
}

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
      const [projects, members] = await Promise.all([
        listCompanyProjects(prisma, company.id),
        prisma.membership.findMany({
          where: { companyId: company.id, status: "ACTIVE" },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        }),
      ]);
      const projectsWithHours = await Promise.all(
        projects.map(async (project) => {
          const total = await prisma.weeklySubmission.aggregate({
            where: { projectId: project.id },
            _sum: { minutes: true },
          });
          return { project, minutes: total._sum.minutes ?? 0 };
        })
      );
      return { company, projectsWithHours, members };
    })
  );

  return (
    <div className="px-12 py-11">
      {companiesWithProjects.map(({ company, projectsWithHours, members }, i) => (
        <section key={company.id} className={i > 0 ? "mt-16 border-t border-black/[.06] pt-11" : ""}>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{companiesWithProjects.length > 1 ? company.name : "Projects"}</h2>
              <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
                Every project is a claimable line of R&amp;D. Set who did the work and when it began — the rest is
                captured week by week.
              </p>
            </div>
            <a href={`#new-project-${company.id}`} className={buttonPrimary}>
              New project
            </a>
          </div>

          <div className="grid grid-cols-[1.6fr_1fr] items-start gap-7">
            <div className="flex flex-col gap-3">
              {projectsWithHours.map(({ project, minutes }) => {
                const archived = project.status !== "ACTIVE";
                const { value, unit } = hoursLabel(minutes);
                return (
                  <div key={project.id} className="flex items-center justify-between rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-5">
                    <div>
                      <div className="flex items-center gap-[10px]">
                        <h4 className={`m-0 text-[16.5px] font-[600] tracking-[-0.02em] ${archived ? "text-text-secondary" : "text-text"}`}>{project.name}</h4>
                        <span className={archived ? badgeNeutral : badgeAccent}>{archived ? "Archived" : "Active"}</span>
                      </div>
                      <div className={`mt-[6px] text-[13px] ${archived ? "text-text-quaternary" : "text-text-tertiary"}`}>
                        Started {new Date(project.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                        {project.competentProfessionals.map((cp) => cp.name).join(", ") || "no competent professional named"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[21px] font-[600] tracking-[-0.025em] ${archived ? "text-text-secondary" : "text-text"}`}>
                        {value}
                        <span className={`text-[14px] font-[500] ${archived ? "text-text-quaternary" : "text-text-tertiary"}`}>{unit}</span>
                      </div>
                      <div className="text-[11.5px] text-text-quaternary">logged</div>
                    </div>
                  </div>
                );
              })}
              {projectsWithHours.length === 0 && <p className="text-sm text-text-tertiary">No projects yet.</p>}

              <div id={`new-project-${company.id}`} className="mt-1 scroll-mt-6">
                <ProjectForm companyId={company.id} />
              </div>
            </div>

            <InviteForm companyId={company.id} seats={members.map((m) => ({ id: m.id, name: m.user.name, role: m.role }))} />
          </div>
        </section>
      ))}

      {companiesWithProjects.length === 0 && <p className="text-sm text-text-secondary">You need to be a company owner to create projects.</p>}
    </div>
  );
}
