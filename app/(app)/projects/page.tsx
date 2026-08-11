import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageCompany, type MembershipLike } from "@/lib/auth/roles";
import { listCompanyProjects } from "@/lib/projects/repository";
import { ProjectForm } from "./ProjectForm";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const adminCompanyIds = (currentUser.memberships as MembershipLike[])
    .filter((m) => canManageCompany(m))
    .map((m) => m.companyId);

  const companies = await prisma.company.findMany({ where: { id: { in: adminCompanyIds } } });

  const companiesWithProjects = await Promise.all(
    companies.map(async (company) => ({
      company,
      projects: await listCompanyProjects(prisma, company.id),
    }))
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Projects</h1>

      {companiesWithProjects.map(({ company, projects }) => (
        <section key={company.id} className="mt-8">
          <h2 className="text-base font-medium text-black dark:text-zinc-50">{company.name}</h2>

          <ul className="mt-3 flex flex-col gap-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="rounded border border-black/[.08] p-3 text-sm dark:border-white/[.08]"
              >
                <p className="font-medium text-black dark:text-zinc-50">{project.name}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Started {new Date(project.startDate).toLocaleDateString("en-GB")} · Competent
                  professional(s): {project.competentProfessionals.map((cp) => cp.name).join(", ")}
                </p>
              </li>
            ))}
            {projects.length === 0 && (
              <li className="text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</li>
            )}
          </ul>

          <div className="mt-4">
            <ProjectForm companyId={company.id} />
          </div>
        </section>
      ))}

      {companiesWithProjects.length === 0 && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          You need to be a company admin to create projects.
        </p>
      )}
    </div>
  );
}
