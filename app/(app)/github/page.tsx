import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey } from "@/lib/capture/week-key";
import { eyebrow } from "@/app/components/ui";
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
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className={eyebrow}>GitHub</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Suggestions, never evidence on their own</h1>
      <p className="mt-2 text-sm text-foreground/60">
        Commits and pull requests never become evidence on their own — link a repo, and anything it sends over shows
        up here as a suggestion until a human confirms it against a specific uncertainty.
      </p>

      <div className="mt-6">
        <GithubClient projects={projects} webhookUrl={webhookUrl} currentWeekKey={currentWeekKey} />
      </div>

      {projects.length === 0 && (
        <p className="mt-4 text-sm text-foreground/50">No projects you can manage GitHub links or suggestions for.</p>
      )}
    </div>
  );
}
