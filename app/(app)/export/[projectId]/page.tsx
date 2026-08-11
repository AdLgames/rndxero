import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getProjectClaimPack } from "@/lib/export/pack";
import { Panel } from "@/app/components/Panel";
import { buttonPrimary, buttonSecondary, eyebrow } from "@/app/components/ui";

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
          <p className="text-sm text-foreground/60">You don&apos;t have access to export this project.</p>
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

  const weekKeys = new Set(pack.integrity.map((row) => row.weekKey));
  const lockedWeeks = pack.integrity.filter((row) => row.lockedAt !== null).length;
  const amendmentCount =
    pack.integrity.reduce((sum, row) => sum + row.amendments.length, 0) +
    pack.uncertainties.reduce((sum, u) => sum + u.chronology.reduce((s, e) => s + e.amendments.length, 0), 0);

  const query = `?companyId=${project.companyId}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className={eyebrow}>06 · Export — {project.name}</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">The evidence dossier</h1>

      <div className="mt-4 border border-sage-dark bg-sage/5 p-3 text-xs text-sage-dark">
        This is a contemporaneous record of work and evidence, not a claim. It does not determine R&amp;D tax
        relief eligibility, decide what qualifies as R&amp;D, or calculate any relief value.
      </div>

      <Panel className="mt-6 p-4">
        <p className={eyebrow}>Live preview</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-foreground/50">Weeks</dt>
            <dd className="font-semibold text-foreground">{weekKeys.size}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Uncertainties</dt>
            <dd className="font-semibold text-foreground">{pack.uncertainties.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Total hours</dt>
            <dd className="font-semibold text-foreground">{hoursLabel(pack.totals.actualMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Planned</dt>
            <dd className="font-semibold text-foreground">{hoursLabel(pack.totals.plannedMinutes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Locked weeks</dt>
            <dd className="font-semibold text-sage-dark">
              {lockedWeeks} / {weekKeys.size}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Amendments</dt>
            <dd className="font-semibold text-foreground">{amendmentCount}</dd>
          </div>
          {includeCosts && pack.totals.derivedCostMinorUnits !== null && (
            <div>
              <dt className="text-xs text-foreground/50">Derived cost</dt>
              <dd className="font-semibold text-foreground">£{(pack.totals.derivedCostMinorUnits / 100).toFixed(2)}</dd>
            </div>
          )}
        </dl>
      </Panel>

      <div className="mt-6 flex flex-wrap gap-2">
        <a href={`/api/export/${projectId}${query}&format=pdf`} className={buttonPrimary}>
          Download PDF
        </a>
        <a href={`/api/export/${projectId}${query}&format=csv`} className={buttonSecondary}>
          Download CSV
        </a>
        <a href={`/api/export/${projectId}${query}&format=json`} className={buttonSecondary}>
          Download JSON
        </a>
      </div>

      <p className={`mt-8 ${eyebrow}`}>Uncertainty narratives</p>
      <ul className="mt-2 flex flex-col gap-3">
        {pack.uncertainties.map((u) => (
          <Panel key={u.id} as="li" className="p-3 text-sm">
            <p className="font-semibold text-foreground">{u.title}</p>
            <p className="mt-1 text-foreground/60">
              {u.outcome} · {hoursLabel(u.totalMinutes)} attributed · {u.chronology.length} entr{u.chronology.length === 1 ? "y" : "ies"}
            </p>
          </Panel>
        ))}
        {pack.uncertainties.length === 0 && <li className="text-sm text-foreground/50">No uncertainties recorded yet.</li>}
      </ul>
    </div>
  );
}
