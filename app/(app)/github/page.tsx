import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey } from "@/lib/capture/week-key";
import { GithubClient, type ProjectGithubData } from "./GithubClient";

export default async function GithubPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  const projectsByCompany = await Promise.all(
    companyIds.map(async (companyId) => {
      const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
      const projects = await prisma.project.findMany({ where: { id: { in: accessibleProjectIds }, status: "ACTIVE" } });

      return Promise.all(
        projects.map(async (project) => {
          const [canManageRepos, canReviewSuggestions] = await Promise.all([
            canDo(prisma, { userId: currentUser.id, companyId, projectId: project.id, action: "project:update" }),
            canDo(prisma, { userId: currentUser.id, companyId, projectId: project.id, action: "note:create" }),
          ]);
          if (!canManageRepos && !canReviewSuggestions) return null;

          const [repoLinks, suggestions, uncertainties] = await Promise.all([
            canManageRepos ? prisma.githubRepoLink.findMany({ where: { projectId: project.id } }) : [],
            canReviewSuggestions
              ? prisma.suggestion.findMany({ where: { projectId: project.id, status: "PENDING" }, orderBy: { createdAt: "desc" } })
              : [],
            prisma.uncertainty.findMany({ where: { projectId: project.id, outcome: "OPEN" }, select: { id: true, title: true } }),
          ]);

          const data: ProjectGithubData = {
            projectId: project.id,
            projectName: project.name,
            companyId,
            canManageRepos,
            canReviewSuggestions,
            repoLinks: repoLinks.map((r) => ({ id: r.id, repoFullName: r.repoFullName, webhookSecret: r.webhookSecret })),
            suggestions: suggestions.map((s) => ({ id: s.id, summary: s.summary, externalRef: s.externalRef })),
            uncertainties,
          };
          return data;
        })
      );
    })
  );

  const projects = projectsByCompany.flat().filter((p): p is ProjectGithubData => p !== null);
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const webhookUrl = `${protocol}://${host}/api/github/webhook`;
  const currentWeekKey = getIsoWeekKey(new Date());

  return (
    <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-8 sm:py-11 lg:px-12 lg:py-13">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">GitHub</h2>
      <p className="m-0 mt-[7px] mb-8 text-[15px] leading-[1.5] text-text-secondary">
        Commits and pull requests never become evidence on their own — link a repo, and anything it sends over shows
        up here as a suggestion until a human confirms it against a specific uncertainty.
      </p>

      <GithubClient projects={projects} webhookUrl={webhookUrl} currentWeekKey={currentWeekKey} />

      {projects.length === 0 && (
        <p className="mt-4 text-[14px] text-text-secondary">No projects you can manage GitHub links or suggestions for.</p>
      )}
    </div>
  );
}
