import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listCompanyProjects } from "@/lib/projects/repository";
import { Panel } from "@/app/components/Panel";
import { badgeNeutral, badgeSage, eyebrow } from "@/app/components/ui";
import { ProjectForm } from "./ProjectForm";
import { InviteForm } from "./InviteForm";

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
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
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className={eyebrow}>01 · Projects</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Setup &amp; team</h1>
      <p className="mt-2 max-w-xl text-sm text-foreground/60">
        Every project is a claimable line of R&amp;D. Set who did the work and when it began; the rest is captured
        week by week.
      </p>

      {companiesWithProjects.map(({ company, projectsWithHours, members }) => (
        <section key={company.id} className="mt-10 border-t border-steel/30 pt-8">
          <h2 className="text-lg font-bold text-foreground">{company.name}</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projectsWithHours.map(({ project, minutes }) => (
              <Panel key={project.id} className="p-3">
                <p className="font-semibold text-foreground">{project.name}</p>
                <p className="mt-1 text-xs text-foreground/60">
                  Started {new Date(project.startDate).toLocaleDateString("en-GB")}
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  {project.competentProfessionals.map((cp) => cp.name).join(", ") || "No competent professional named"}
                </p>
                <p className="mt-2 text-sm font-semibold text-steel-dark">{hoursLabel(minutes)} logged</p>
              </Panel>
            ))}
            {projectsWithHours.length === 0 && <p className="text-sm text-foreground/50 sm:col-span-2">No projects yet.</p>}
          </div>

          <div className="mt-4">
            <ProjectForm companyId={company.id} />
          </div>

          <div className="mt-8 border-t border-steel/20 pt-6">
            <p className={eyebrow}>Team</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id} className={m.role === "ADVISER" ? badgeSage : badgeNeutral}>
                  {m.user.name} · {m.role === "ADVISER" ? "Adviser (free)" : m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <InviteForm companyId={company.id} />
            </div>
          </div>
        </section>
      ))}

      {companiesWithProjects.length === 0 && (
        <p className="mt-8 text-sm text-foreground/60">You need to be a company owner to create projects.</p>
      )}
    </div>
  );
}
