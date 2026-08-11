import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getProjectClaimPack } from "@/lib/export/pack";

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "export:read" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">You don&apos;t have access to export this project.</p>
        </div>
      );
    }
    throw error;
  }

  const includeCosts = await canDo(prisma, {
    userId: currentUser.id,
    companyId: project.companyId,
    projectId,
    action: "cost:read",
  });
  const pack = await getProjectClaimPack(prisma, { projectId, includeCosts });

  const query = `?companyId=${project.companyId}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{project.name} — Export</h1>

      <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        This is a contemporaneous record of work and evidence, not a claim. It does not determine R&amp;D tax
        relief eligibility, decide what qualifies as R&amp;D, or calculate any relief value.
      </div>

      <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
        {pack.uncertainties.length} uncertaint{pack.uncertainties.length === 1 ? "y" : "ies"} · {hoursLabel(pack.totals.actualMinutes)} logged
        against {hoursLabel(pack.totals.plannedMinutes)} currently planned
        {includeCosts && pack.totals.derivedCostMinorUnits !== null
          ? ` · £${(pack.totals.derivedCostMinorUnits / 100).toFixed(2)} derived labour cost`
          : ""}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={`/api/export/${projectId}${query}&format=pdf`}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Download PDF
        </a>
        <a
          href={`/api/export/${projectId}${query}&format=csv`}
          className="rounded border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.145] dark:text-zinc-50"
        >
          Download CSV
        </a>
        <a
          href={`/api/export/${projectId}${query}&format=json`}
          className="rounded border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.145] dark:text-zinc-50"
        >
          Download JSON
        </a>
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {pack.uncertainties.map((u) => (
          <li key={u.id} className="rounded border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
            <p className="font-medium text-black dark:text-zinc-50">{u.title}</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {u.outcome} · {hoursLabel(u.totalMinutes)} attributed · {u.chronology.length} entr{u.chronology.length === 1 ? "y" : "ies"}
            </p>
          </li>
        ))}
        {pack.uncertainties.length === 0 && (
          <li className="text-sm text-zinc-500 dark:text-zinc-400">No uncertainties recorded yet.</li>
        )}
      </ul>
    </div>
  );
}
