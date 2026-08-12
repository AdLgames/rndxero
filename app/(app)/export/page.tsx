import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";

export default async function ExportIndexPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  const projectsByCompany = await Promise.all(
    companyIds.map(async (companyId) => {
      const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
      const projects = await prisma.project.findMany({ where: { id: { in: accessibleProjectIds } } });
      const exportable = await Promise.all(
        projects.map(async (project) => ({
          project,
          canExport: await canDo(prisma, { userId: currentUser.id, companyId, projectId: project.id, action: "export:read" }),
        }))
      );
      return exportable.filter((p) => p.canExport).map((p) => p.project);
    })
  );

  const allProjects = projectsByCompany.flat();

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Export</h2>
      <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
        Hand an adviser a complete, dated record. Pick a project to assemble its evidence dossier.
      </p>

      <div className="mt-8 flex flex-col gap-[10px]">
        {allProjects.map((project) => (
          <Link
            key={project.id}
            href={`/export/${project.id}`}
            className="flex items-center justify-between rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-[18px] text-[15px] font-[600] tracking-[-0.02em] text-text transition-colors duration-150 hover:bg-surface-header"
          >
            {project.name}
          </Link>
        ))}
        {allProjects.length === 0 && <p className="text-[14px] text-text-secondary">No projects you can export yet.</p>}
      </div>
    </div>
  );
}
